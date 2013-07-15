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

  var i
  this._inputs = []
  for (i = 0; i < this.numberOfInputs; i++) this._inputs.push(new AudioInput(this, i))
  this._outputs = []
  for (i = 0; i < this.numberOfOutputs; i++) this._outputs.push(new AudioOutput(this, i))

  this.closed = false
  this.channels = null
  this.init.apply(this, arguments)
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

  pullAudio: function(outBuffer, done) { throw new Error('Implement me') }


})

var HasOutput = {

	_initOutput: function() {
    this.output = null
		this._buffers = this._makeChannels()
	},
	
	// TODO: is it better to use concat to create the buffer? or splice?
	read: function(blockSize, done) {
		var self = this
		async.whilst(
    	function () {
        return self._buffers.some(function(buf) {
          return buf.length < blockSize
        })
      },
    	function (next) {
    		self.getBlock(function(err, block) {
    			if (err) next(err)
          else if (block.length !== self.channels)
            next(new Error('invalid number of channels'))
    			else {
            block.forEach(function(array, channel) {
              var buf = self._buffers[channel]
              if (array.length === 0)
        			  array = _.range(blockSize - buf.length).map(function() { return 0 })
              self._buffers[channel] = buf.concat(array)
            })
            next()
          }
    		})
    	},
    	function(err) {
    		if (err) done(err)
    		else done(null, self._buffers.map(function(buf) {
          return buf.splice(0, blockSize)
        }))
    	}
    )
	}
	
}

var HasInput = {

	_initInput: function() {
		this.input = null
	},

  _onConnected: function() {},

  connect: function(node) {
    if (node.hasOwnProperty('output')) {
      if (this.input !== node) {
        this.input = node
        node.connect(this)
        this._onConnected()
      }
      return this
    } else {
      throw new Error('the node you are trying to connect to has no output')
    }
  }

}

var DuplexNode = module.exports.DuplexNode = function(inBlockSize) {
	AudioNode.apply(this, arguments)
	this._initInput(inBlockSize)
	this._initOutput()
}
inherits(DuplexNode, AudioNode)
_.extend(DuplexNode.prototype, HasOutput, HasInput)
DuplexNode.extend = utils.chainExtend


var SourceNode = module.exports.SourceNode = function() {
	AudioNode.apply(this, arguments)
	this._initOutput()
}
inherits(SourceNode, AudioNode)
_.extend(SourceNode.prototype, HasOutput)
SourceNode.extend = utils.chainExtend


var SinkNode = module.exports.SinkNode = function(inBlockSize) {
	AudioNode.apply(this, arguments)
	this._initInput(inBlockSize)
}
inherits(SinkNode, AudioNode)
_.extend(SinkNode.prototype, HasInput)
SinkNode.extend = utils.chainExtend
