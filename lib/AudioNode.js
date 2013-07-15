var inherits = require('util').inherits
	, EventEmitter = require('events').EventEmitter
	, async = require('async')
	, _ = require('underscore')
	, utils = require('./utils')
  , readOnlyAttr = utils.readOnlyAttr
  , AudioInput = require('./audioports').AudioInput
  , AudioOutput = require('./audioports').AudioOutput

var ChannelCountMode = ['max', 'clamped-max', 'explicit']
  , ChannelInterpretation = ['speakers', 'discrete']

var AudioNode = module.exports = function(context, numberOfInputs, numberOfOutputs) {
  readOnlyAttr(this, 'context', context)
  readOnlyAttr(this, 'numberOfInputs', numberOfInputs)
  readOnlyAttr(this, 'numberOfOutputs', numberOfOutputs)

  var channelCount = 2
  Object.defineProperty(this, 'channelCount', {
    get: function() {
      return channelCount
    },
    set: function(val) {
      if (val < 1) throw new Error('Invalid number of channels')
      channelCount = val
    }
  })

  var channelCountMode
  Object.defineProperty(this, 'channelCountMode', {
    get: function() {
      return channelCountMode
    },
    set: function(val) {
      if(ChannelCountMode.indexOf(val) === -1)
        throw new Error('Unvalid value for channelCountMode : ' + val)
      channelCountMode = val
    } 
  })

  var channelInterpretation
  Object.defineProperty(this, 'channelInterpretation', {
    get: function() {
      return channelInterpretation
    },
    set: function(val) {
      if(ChannelInterpretation.indexOf(val) === -1)
        throw new Error('Unvalid value for channelInterpretation : ' + val)
      channelInterpretation = val
    } 
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
inherits(AudioNode, EventEmitter)

_.extend(AudioNode.prototype, {

  connect: function(destination, output, input) {
    if (_.isUndefined(output)) output = 0
    if (_.isUndefined(input)) input = 0
    if (output >= this.numberOfOutputs)
      throw new Error('output out of bounds ' + output)
    if (input >= destination.numberOfInputs)
      throw new Error('input out of bounds' + input)
    this._outputs[output].connect(destination._inputs[input])
  },

  disconnect: function(output) {
    if (output >= this.numberOfOutputs)
      throw new Error('output out of bounds ' + output)
    var audioOut = this._outputs[output]
    audioOut.sinks.slice(0).forEach(function(sink) {
      audioOut.disconnect(sink)
    })
  },

  close: function() {
    this.closed = true
    this.getBlock = function(done) { done(null, this._makeChannels()) }
  },

  pullAudio: function(done) { throw new Error('Implement me') }


})
