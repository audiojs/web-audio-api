var EventEmitter = require('events').EventEmitter
  , async = require('async')
  , utils = require('./utils')
  , readOnlyAttr = utils.readOnlyAttr
  , DspObject = require('./DspObject')
  , AudioInput = require('./audioports').AudioInput
  , AudioOutput = require('./audioports').AudioOutput

var ChannelCountMode = ['max', 'clamped-max', 'explicit'],
  ChannelInterpretation = ['speakers', 'discrete']

class AudioNode extends DspObject {

  constructor(context, numberOfInputs, numberOfOutputs, channelCount, channelCountMode, channelInterpretation) {

    super(context)

    readOnlyAttr(this, 'context', context)
    readOnlyAttr(this, 'numberOfInputs', numberOfInputs)
    readOnlyAttr(this, 'numberOfOutputs', numberOfOutputs)

    channelCount = channelCount || 2
    Object.defineProperty(this, 'channelCount', {
      get: function() {
        return channelCount
      },
      set: function(val) {
        if (val < 1) throw new Error('Invalid number of channels')
        channelCount = val
      },
      configurable: true
    })

    var channelCountMode = channelCountMode
    Object.defineProperty(this, 'channelCountMode', {
      get: function() {
        return channelCountMode
      },
      set: function(val) {
        if (ChannelCountMode.indexOf(val) === -1)
          throw new Error('Unvalid value for channelCountMode : ' + val)
        channelCountMode = val
      },
      configurable: true
    })

    var channelInterpretation = channelInterpretation
    Object.defineProperty(this, 'channelInterpretation', {
      get: function() {
        return channelInterpretation
      },
      set: function(val) {
        if (ChannelInterpretation.indexOf(val) === -1)
          throw new Error('Unvalid value for channelInterpretation : ' + val)
        channelInterpretation = val
      },
      configurable: true
    })

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
  _kill() {
    this._inputs.forEach(function(input) {
      input._kill()
    })
    this._outputs.forEach(function(output) {
      output._kill()
    })
    this.removeAllListeners()
    this._tick = function() {
      throw new Error('this node has been killed')
    }
  }

}

module.exports = AudioNode
