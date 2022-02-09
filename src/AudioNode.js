import {EventEmitter} from 'events'
import * as utils from './utils.js'
import DspObject from './DspObject.js'
import {AudioInput, AudioOutput} from './audioports.js'

let readOnlyAttr = utils.readOnlyAttr
var ChannelCountMode = ['max', 'clamped-max', 'explicit'],
  ChannelInterpretation = ['speakers', 'discrete']

class AudioNode extends DspObject {
  #channelCount
  get channelCount() { return this.#channelCount }
  set channelCount(val) {
    if (val < 1) throw new Error('Invalid number of channels')
    this.#channelCount = val
  }

  #channelCountMode
  get channelCountMode() { return this.#channelCountMode }
  set channelCountMode(val) {
    if (!ChannelCountMode.includes(val)) throw new Error('Unvalid value for channelCountMode : ' + val)
    this.#channelCountMode = val
  }

  #channelInterpretation
  get channelInterpretation() { return this.#channelInterpretation }
  set channelInterpretation(val) {
    if (!ChannelInterpretation.includes(val)) throw new Error('Unvalid value for channelInterpretation : ' + val)
    this.#channelInterpretation = val
  }

  #numberOfInputs
  get numberOfInputs() { return this.#numberOfInputs }

  #numberOfOutputs
  get numberOfOutputs() { return this.#numberOfOutputs }

  constructor(context, numberOfInputs, numberOfOutputs, channelCount, channelCountMode, channelInterpretation) {

    super(context)

    this.#numberOfInputs = numberOfInputs
    this.#numberOfOutputs = numberOfOutputs
    this.#channelCount = channelCount || 2
    this.#channelCountMode = channelCountMode
    this.#channelInterpretation = channelInterpretation

    // Initialize audio ports
    var i
    this._inputs = []
    this._outputs = []
    for (i = 0; i < this.numberOfInputs; i++)
      this._inputs.push(new AudioInput(context, this, i))
    for (i = 0; i < this.numberOfOutputs; i++)
      this._outputs.push(new AudioOutput(context, this, i))
  }

  connect(destination, output = 0, input = 0) {
    if (output >= this.numberOfOutputs)
      throw new Error('output out of bounds ' + output)
    if (input >= destination.numberOfInputs)
      throw new Error('input out of bounds ' + input)
    this._outputs[output].connect(destination._inputs[input])
  }

  disconnect(output = 0) {
    if (output >= this.numberOfOutputs)
      throw new Error('output out of bounds ' + output)
    var audioOut = this._outputs[output]
    audioOut.sinks.slice(0).forEach(function(sink) {
      audioOut.disconnect(sink)
    })
  }

  // Disconnects all ports and remove all events listeners
  [Symbol.dispose]() {
    this._inputs.forEach((input) => input[Symbol.dispose]())
    this._outputs.forEach((output) => output[Symbol.dispose]())
    this.removeAllListeners()
    this._tick = () => {
      throw new Error('this node has been disposed')
    }
  }

}

export default AudioNode
