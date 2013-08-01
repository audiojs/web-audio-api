var _ = require('underscore')
  , async = require('async')
  , inherits = require('util').inherits
  , EventEmitter = require('events').EventEmitter
  , utils = require('./utils')
  , AudioBuffer = require('audiobuffer')
  , BLOCK_SIZE = require('./constants').BLOCK_SIZE

var AudioPort = function(context, node, id) {
  this.connections = []
  this.node = node
  this.id = id
  this.context = context
}
inherits(AudioPort, EventEmitter)

_.extend(AudioPort.prototype, {

  // Generic function for connecting the calling AudioPort
  // with `otherPort`. Returns true if a connection was indeed established
  connect: function(otherPort) {
    if (this.connections.indexOf(otherPort) !== -1) return false
    this.connections.push(otherPort)
    otherPort.connect(this)
    this.emit('connection', otherPort)
    return true
  },

  // Generic function for disconnecting the calling AudioPort
  // from `otherPort`. Returns true if a disconnection was indeed made
  disconnect: function(otherPort) {
    var connInd = this.connections.indexOf(otherPort)
    if (connInd === -1) return false
    this.connections.splice(connInd, 1)
    otherPort.disconnect(this)
    this.emit('disconnection', otherPort)
    return true
  },

  // Called when a node is killed. Removes connections, and event listeners.
  _kill: function() {
    var self = this
    this.connections.slice(0).forEach(function(port) {
      self.disconnect(port)
    })
    this.removeAllListeners()
  }

})

var AudioInput = module.exports.AudioInput = function() {
  AudioPort.apply(this, arguments)
  var self = this

  // `computedNumberOfChannels` is scheduled to be recalculated everytime a connection
  // or disconnection happens.
  this.computedNumberOfChannels = null
  this.on('connected', function() { self.computedNumberOfChannels = null })
  this.on('disconnected', function() { self.computedNumberOfChannels = null })

  // Just for code clarity
  Object.defineProperty(this, 'sources', {
    get: function() { return this.connections }
  })
}
inherits(AudioInput, AudioPort)

_.extend(AudioInput.prototype, {

  connect: function(source) {
    var self = this
    // When the number of channels of the source changes, we trigger
    // computation of `computedNumberOfChannels`
    source.on('_numberOfChannels', function() {
      self.computedNumberOfChannels = null
    })
    AudioPort.prototype.connect.call(this, source)
  },

  disconnect: function(source) {
    source.removeAllListeners('_numberOfChannels')
    AudioPort.prototype.disconnect.call(this, source)
  },

  _tick: function() {
    var self = this
      , channelInterpretation = this.node.channelInterpretation
      , mixRatio = 1 / this.sources.length
      , i, ch, chDataIn, chDataOut, inNumChannels
      , inBuffers = this.sources.map(function(source) { return source._tick() })

    if (self.computedNumberOfChannels === null) {
      var maxChannelsUpstream
      if (this.sources.length) {
        maxChannelsUpstream = _.chain(inBuffers).pluck('numberOfChannels').max().value()
      } else maxChannelsUpstream = 0
      self._computeNumberOfChannels(maxChannelsUpstream)
    }
    var computedNumberOfChannels = self.computedNumberOfChannels
      , outBuffer = new AudioBuffer(computedNumberOfChannels, BLOCK_SIZE, self.context.sampleRate)

    inBuffers.forEach(function(inBuffer) {

      // Down-mixing the source
      if (inBuffer.numberOfChannels > computedNumberOfChannels) {
        if (channelInterpretation === 'discrete') {
          for (ch = 0; ch < computedNumberOfChannels; ch++) {
            chDataIn = inBuffer.getChannelData(ch)
            chDataOut = outBuffer.getChannelData(ch)
            for (i = 0; i < BLOCK_SIZE; i++) chDataOut[i] += chDataIn[i] * mixRatio
          }
        } else if (channelInterpretation === 'speakers') {
          throw new Error('not implemented')
        // shouldn't happen
        } else throw new Error('invalid channelInterpretation : ' + channelInterpretation)

      // Up-mixing the source
      } else {
        if (channelInterpretation === 'discrete') {
          inNumChannels = inBuffer.numberOfChannels
          for (ch = 0; ch < inNumChannels; ch++) {
            chDataIn = inBuffer.getChannelData(ch)
            chDataOut = outBuffer.getChannelData(ch)
            for (i = 0; i < BLOCK_SIZE; i++) chDataOut[i] += chDataIn[i] * mixRatio
          }
        } else if (channelInterpretation === 'speakers') {
          debugger
          throw new Error('not implemented')
          // shouldn't happen
        } else throw new Error('invalid channelInterpretation : ' + channelInterpretation)
      }
    })
    return outBuffer

  },

  _computeNumberOfChannels: function(maxChannelsUpstream) {
    var countMode = this.node.channelCountMode
      , channelCount = this.node.channelCount
    maxChannelsUpstream = maxChannelsUpstream || 1

    if (countMode === 'max') {
      this.computedNumberOfChannels = maxChannelsUpstream
    } else if (countMode === 'clamped-max') {
      this.computedNumberOfChannels = Math.min(maxChannelsUpstream, channelCount)
    } else if (countMode === 'explicit')
      this.computedNumberOfChannels = channelCount
    // this shouldn't happen
    else throw new Error('invalid channelCountMode')
  }

})

var AudioOutput = module.exports.AudioOutput = function() {
  AudioPort.apply(this, arguments)

  // This caches the block fetched from the node. 
  this._cachedBlock = {time: -1, buffer: null}

  // This catches the number of channels of the audio going through this output
  this._numberOfChannels = null

  // Just for code clarity
  Object.defineProperty(this, 'sinks', {
    get: function() { return this.connections }
  })
}
inherits(AudioOutput, AudioPort)

_.extend(AudioOutput.prototype, {

  // Pulls the audio from the node only once, and copies it so that several
  // nodes downstream can pull the same block.
  _tick: function() {
    var self = this
    if (this._cachedBlock.time < this.context.currentTime) {
      var outBuffer = this.node._tick()
      if (self._numberOfChannels !== outBuffer.numberOfChannels) {
        self._numberOfChannels = outBuffer.numberOfChannels
        self.emit('_numberOfChannels')
      }
      self._cachedBlock = {time: self.context.currentTime, buffer: outBuffer}
      return outBuffer
    } else return this._cachedBlock.buffer
  }

})