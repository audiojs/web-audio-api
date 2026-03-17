import DspObject from './DspObject.js'
import {AudioInput, AudioOutput} from './audioports.js'
import { IndexSizeError, InvalidStateError, NotSupportedError } from './errors.js'

const CHANNEL_COUNT_MODES = ['max', 'clamped-max', 'explicit']
const CHANNEL_INTERPRETATIONS = ['speakers', 'discrete']

class AudioNode extends DspObject {
  #channelCount
  get channelCount() { return this.#channelCount }
  set channelCount(val) {
    if (val < 1 || val > 32) throw new NotSupportedError('channelCount must be between 1 and 32')
    this._validateChannelCount(val)
    this.#channelCount = val
  }

  #channelCountMode
  get channelCountMode() { return this.#channelCountMode }
  set channelCountMode(val) {
    if (!CHANNEL_COUNT_MODES.includes(val)) throw new TypeError('Invalid value for channelCountMode: ' + val)
    this._validateChannelCountMode(val)
    this.#channelCountMode = val
  }

  #channelInterpretation
  get channelInterpretation() { return this.#channelInterpretation }
  set channelInterpretation(val) {
    if (!CHANNEL_INTERPRETATIONS.includes(val)) throw new TypeError('Invalid value for channelInterpretation: ' + val)
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
    if (context._state === 'closed') throw new InvalidStateError('cannot create node on closed context')
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
    if ('channelCountMode' in opts) this.channelCountMode = opts.channelCountMode
    if ('channelInterpretation' in opts) this.channelInterpretation = opts.channelInterpretation
  }

  connect(destination, output = 0, input = 0) {
    if (!destination) throw new TypeError('destination must be an AudioNode or AudioParam')
    // connect to AudioParam
    if (destination._input && destination.defaultValue !== undefined) {
      if (output >= this.numberOfOutputs) throw new IndexSizeError('output index ' + output + ' out of bounds')
      this._outputs[output].connect(destination._input)
      return undefined
    }
    // connect to AudioNode
    if (typeof destination.numberOfInputs === 'undefined')
      throw new TypeError('destination must be an AudioNode or AudioParam')
    if (output >= this.numberOfOutputs) throw new IndexSizeError('output index ' + output + ' out of bounds')
    if (input >= destination.numberOfInputs) throw new IndexSizeError('input index ' + input + ' out of bounds')
    this._outputs[output].connect(destination._inputs[input])
    return destination
  }

  disconnect(outputOrDest, output, input) {
    if (outputOrDest === undefined) {
      for (let o of this._outputs) o.sinks.slice(0).forEach(sink => o.disconnect(sink))
      return
    }
    if (typeof outputOrDest === 'number') {
      if (outputOrDest >= this.numberOfOutputs) throw new IndexSizeError('output index ' + outputOrDest + ' out of bounds')
      let o = this._outputs[outputOrDest]
      o.sinks.slice(0).forEach(sink => o.disconnect(sink))
      return
    }
    let dest = outputOrDest
    output = output ?? 0
    // disconnect from AudioParam
    if (dest._input && dest.defaultValue !== undefined) {
      if (output >= this.numberOfOutputs) throw new IndexSizeError('output index ' + output + ' out of bounds')
      let o = this._outputs[output]
      if (o.sinks.includes(dest._input)) o.disconnect(dest._input)
      return
    }
    // disconnect from AudioNode
    input = input ?? 0
    if (output >= this.numberOfOutputs) throw new IndexSizeError('output index ' + output + ' out of bounds')
    let o = this._outputs[output]
    let target = dest._inputs[input]
    if (target && o.sinks.includes(target)) o.disconnect(target)
  }

  [Symbol.dispose]() {
    this._inputs.forEach(input => input[Symbol.dispose]())
    this._outputs.forEach(output => output[Symbol.dispose]())
    this.removeAllListeners()
    this._tick = () => { throw new Error('this node has been disposed') }
  }

}

export default AudioNode
