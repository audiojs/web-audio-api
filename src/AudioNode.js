import DspObject from './DspObject.js'
import {AudioInput, AudioOutput} from './audioports.js'
import { DOMErr } from './errors.js'

const CHANNEL_COUNT_MODES = ['max', 'clamped-max', 'explicit']
const CHANNEL_INTERPRETATIONS = ['speakers', 'discrete']

class AudioNode extends DspObject {
  #channelCount
  get channelCount() { return this.#channelCount }
  set channelCount(val) {
    this._validateChannelCount(val)
    if (val < 1 || val > 32) throw DOMErr('channelCount must be between 1 and 32', 'NotSupportedError')
    this.#channelCount = val
  }

  #channelCountMode
  get channelCountMode() { return this.#channelCountMode }
  set channelCountMode(val) {
    if (!CHANNEL_COUNT_MODES.includes(val)) return // spec: silently ignore invalid enum values
    this._validateChannelCountMode(val)
    this.#channelCountMode = val
  }

  #channelInterpretation
  get channelInterpretation() { return this.#channelInterpretation }
  set channelInterpretation(val) {
    if (!CHANNEL_INTERPRETATIONS.includes(val)) return // spec: silently ignore invalid enum values
    this._validateChannelInterpretation(val)
    this.#channelInterpretation = val
  }

  #numberOfInputs
  get numberOfInputs() { return this.#numberOfInputs }

  #numberOfOutputs
  get numberOfOutputs() { return this.#numberOfOutputs }

  // Validation hooks — subclasses override to add constraints
  _validateChannelCount(val) {}
  _validateChannelCountMode(val) {}
  _validateChannelInterpretation(val) {}

  // Validate options dict: must be undefined/null or an object (W3C spec)
  static _checkOpts(opts) {
    if (opts !== undefined && opts !== null && typeof opts !== 'object')
      throw new TypeError('Options must be an object')
    return opts || {}
  }

  constructor(context, numberOfInputs, numberOfOutputs, channelCount, channelCountMode, channelInterpretation) {
    if (!context || typeof context !== 'object' || !('sampleRate' in context))
      throw new TypeError('Expected BaseAudioContext as first argument')
    if (context._state === 'closed') throw DOMErr('cannot create node on closed context', 'InvalidStateError')
    super(context)

    this.#numberOfInputs = numberOfInputs
    this.#numberOfOutputs = numberOfOutputs
    this.#channelCount = channelCount || 2
    this.#channelCountMode = channelCountMode || 'max'
    this.#channelInterpretation = channelInterpretation || 'speakers'

    this._inputs = []
    this._outputs = []
    for (let i = 0; i < this.numberOfInputs; i++)
      this._inputs.push(new AudioInput(context, this, i))
    for (let i = 0; i < this.numberOfOutputs; i++)
      this._outputs.push(new AudioOutput(context, this, i))
  }

  // Apply channel properties from options dict through validated setters
  _applyOpts(opts) {
    if ('channelCount' in opts) this.channelCount = opts.channelCount
    if (opts.channelCountMode !== undefined) {
      if (!CHANNEL_COUNT_MODES.includes(opts.channelCountMode)) throw new TypeError('Invalid channelCountMode: ' + opts.channelCountMode)
      this.channelCountMode = opts.channelCountMode
    }
    if (opts.channelInterpretation !== undefined) {
      if (!CHANNEL_INTERPRETATIONS.includes(opts.channelInterpretation)) throw new TypeError('Invalid channelInterpretation: ' + opts.channelInterpretation)
      this.channelInterpretation = opts.channelInterpretation
    }
  }

  connect(destination, output = 0, input = 0) {
    if (!destination) throw new TypeError('destination must be an AudioNode or AudioParam')
    // connect to AudioParam
    if (destination._input && destination.defaultValue !== undefined) {
      if (destination.context && this.context && destination.context !== this.context)
        throw DOMErr('cannot connect nodes from different AudioContexts', 'InvalidAccessError')
      if (output >= this.numberOfOutputs) throw DOMErr('output index ' + output + ' out of bounds', 'IndexSizeError')
      this._outputs[output].connect(destination._input)
      return undefined
    }
    // connect to AudioNode
    if (typeof destination.numberOfInputs === 'undefined')
      throw new TypeError('destination must be an AudioNode or AudioParam')
    if (destination.context && this.context && destination.context !== this.context)
      throw DOMErr('cannot connect nodes from different AudioContexts', 'InvalidAccessError')
    if (output >= this.numberOfOutputs) throw DOMErr('output index ' + output + ' out of bounds', 'IndexSizeError')
    if (input >= destination.numberOfInputs) throw DOMErr('input index ' + input + ' out of bounds', 'IndexSizeError')
    this._outputs[output].connect(destination._inputs[input])
    return destination
  }

  disconnect(outputOrDest, output, input) {
    // disconnect() — disconnect all outputs
    if (outputOrDest === undefined) {
      for (let o of this._outputs) o.sinks.slice(0).forEach(sink => o.disconnect(sink))
      return
    }
    // disconnect(output) — disconnect specific output index
    if (typeof outputOrDest === 'number') {
      if (outputOrDest >= this.numberOfOutputs || outputOrDest < 0)
        throw DOMErr('output index ' + outputOrDest + ' out of bounds', 'IndexSizeError')
      let o = this._outputs[outputOrDest]
      o.sinks.slice(0).forEach(sink => o.disconnect(sink))
      return
    }
    let dest = outputOrDest

    // disconnect from AudioParam
    if (dest._input && dest.defaultValue !== undefined) {
      if (dest.context && this.context && dest.context !== this.context)
        throw DOMErr('cannot disconnect nodes from different AudioContexts', 'InvalidAccessError')
      if (output !== undefined) {
        if (output >= this.numberOfOutputs || output < 0)
          throw DOMErr('output index ' + output + ' out of bounds', 'IndexSizeError')
        let o = this._outputs[output]
        if (!o.sinks.includes(dest._input))
          throw DOMErr('not connected to this destination', 'InvalidAccessError')
        o.disconnect(dest._input)
      } else {
        // disconnect(destination) — disconnect all outputs from this AudioParam
        let found = false
        for (let o of this._outputs) {
          if (o.sinks.includes(dest._input)) {
            o.disconnect(dest._input)
            found = true
          }
        }
        if (!found) throw DOMErr('not connected to this destination', 'InvalidAccessError')
      }
      return
    }

    // disconnect from AudioNode
    if (dest.context && this.context && dest.context !== this.context)
      throw DOMErr('cannot disconnect nodes from different AudioContexts', 'InvalidAccessError')
    if (output !== undefined && (output >= this.numberOfOutputs || output < 0))
      throw DOMErr('output index ' + output + ' out of bounds', 'IndexSizeError')
    if (input !== undefined && (input >= dest.numberOfInputs || input < 0))
      throw DOMErr('input index ' + input + ' out of bounds', 'IndexSizeError')

    if (output !== undefined && input !== undefined) {
      // disconnect(destination, output, input) — specific output to specific input
      let o = this._outputs[output]
      let target = dest._inputs[input]
      if (!o.sinks.includes(target))
        throw DOMErr('not connected to this destination', 'InvalidAccessError')
      o.disconnect(target)
    } else if (output !== undefined) {
      // disconnect(destination, output) — specific output from all inputs of destination
      let o = this._outputs[output]
      let found = false
      for (let inp of dest._inputs) {
        if (o.sinks.includes(inp)) {
          o.disconnect(inp)
          found = true
        }
      }
      if (!found) throw DOMErr('not connected to this destination', 'InvalidAccessError')
    } else {
      // disconnect(destination) — all outputs from all inputs of destination
      let found = false
      for (let o of this._outputs) {
        for (let inp of dest._inputs) {
          if (o.sinks.includes(inp)) {
            o.disconnect(inp)
            found = true
          }
        }
      }
      if (!found) throw DOMErr('not connected to this destination', 'InvalidAccessError')
    }
  }

  [Symbol.dispose]() {
    this._inputs.forEach(input => input[Symbol.dispose]())
    this._outputs.forEach(output => output[Symbol.dispose]())
    this.removeAllListeners()
    this._tick = () => { throw new Error('this node has been disposed') }
  }

}

export default AudioNode
