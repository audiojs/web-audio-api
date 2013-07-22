var _ = require('underscore')
  , async = require('async')
  , inherits = require('util').inherits
  , EventEmitter = require('events').EventEmitter
  , utils = require('./utils')
  , AudioBuffer = require('audiobuffer')
  , BLOCK_SIZE = require('./constants').BLOCK_SIZE

var AudioPort = function(context, node, id) {
  this.node = node
  this.id = id
  this.context = context
}
inherits(AudioPort, EventEmitter)

_.extend(AudioPort.prototype, {

  // Connects two ports together
  connect: function(other) { throw new Error('not implemented') },

  // Disconnects two ports
  disconnect: function(other) { throw new Error('not implemented') },

  // Generic function for connecting the calling AudioPort
  // with `otherPort`. Returns true if a connection was indeed established
  _genericConnect: function(allConn, otherPort) {
    if (allConn.indexOf(otherPort) !== -1) return false
    allConn.push(otherPort)
    otherPort.connect(this)
    this.emit('connection', otherPort)
    return true
  },

  // Generic function for disconnecting the calling AudioPort
  // from `otherPort`. Returns true if a disconnection was indeed made
  _genericDisconnect: function(allConn, otherPort) {
    var connInd = allConn.indexOf(otherPort)
    if (connInd === -1) return false
    allConn.splice(connInd, 1)
    otherPort.disconnect(this)
    this.emit('disconnection', otherPort)
    return true
  }

})

var AudioInput = module.exports.AudioInput = function() {
  AudioPort.apply(this, arguments)
  var self = this

  // All AudioOuputs connected to this
  this.sources = []

  // `computedNumberOfChannels` is scheduled to be recalculated everytime a connection
  // or disconnection happens.
  this.computedNumberOfChannels = null
  this.on('connected', function() { self.computedNumberOfChannels = null })
  this.on('disconnected', function() { self.computedNumberOfChannels = null })
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
    this._genericConnect(this.sources, source)
  },

  disconnect: function(source) {
    source.removeAllListeners('_numberOfChannels')
    this._genericDisconnect(this.sources, source)
  },

  pullAudio: function(done) {
    var self = this
      , channelInterpretation = this.node.channelInterpretation
      , mixRatio = 1 / this.sources.length
      , i, ch, chDataIn, chDataOut, inNumChannels
      , parallelPullAudio = this.sources.map(function(source) {
        return function(done) { source.pullAudio(done) }
      })

    async.parallel(parallelPullAudio, function(err, inBuffers) {
      if (err) return done(err)

      if (self.computedNumberOfChannels === null)
        self._computeNumberOfChannels(_.chain(inBuffers).pluck('numberOfChannels').max().value())
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
          } else if (channelInterpretation === 'speaker') {
            throw new Error('not implemented')
          // shouldn't happen
          } else throw new Error('invalid channelInterpretation')

        // Up-mixing the source
        } else {
          if (channelInterpretation === 'discrete') {
            inNumChannels = inBuffer.numberOfChannels
            for (ch = 0; ch < inNumChannels; ch++) {
              chDataIn = inBuffer.getChannelData(ch)
              chDataOut = outBuffer.getChannelData(ch)
              for (i = 0; i < BLOCK_SIZE; i++) chDataOut[i] += chDataIn[i] * mixRatio
            }
          } else if (channelInterpretation === 'speaker') {
              throw new Error('not implemented')
            // shouldn't happen
          } else throw new Error('invalid channelInterpretation')
        }
      })
      done(null, outBuffer)

    })
  },

  _computeNumberOfChannels: function(maxChannelsUpstream) {
    var countMode = this.node.channelCountMode
      , channelCount = this.node.channelCount

    if (countMode === 'max')
      this.computedNumberOfChannels = maxChannelsUpstream
    else if (countMode === 'clamped-max')
      this.computedNumberOfChannels = Math.min(maxChannelsUpstream, channelCount)
    else if (countMode === 'explicit')
      this.computedNumberOfChannels = channelCount
    // this shouldn't happen
    else throw new Error('invalid channelCountMode')
  }

})

var AudioOutput = module.exports.AudioOutput = function() {
  AudioPort.apply(this, arguments)

  // All AudioOutputs this is connected to
  this.sinks = []

  // This caches the block fetched from the node. 
  this._cachedBlock = {time: -1, buffer: null}

  // This catches the number of channels of the audio going through this output
  this._numberOfChannels = null
}
inherits(AudioOutput, AudioPort)

_.extend(AudioOutput.prototype, {

  connect: function(sink) {
    this._genericConnect(this.sinks, sink)
  },

  disconnect: function(sink) {
    this._genericDisconnect(this.sinks, sink)
  },

  // Pulls the audio from the node only once, and copies it so that several
  // nodes downstream can pull the same block.
  pullAudio: function(done) {
    var self = this
    if (this._cachedBlock.time < this.context.currentTime) {
      this.node.pullAudio(function(err, outBuffer) {
        if (err) return done(err)
        if (self._numberOfChannels !== outBuffer.numberOfChannels) {
          self._numberOfChannels = outBuffer.numberOfChannels
          self.emit('_numberOfChannels')
        }
        self._cachedBlock = {time: self.context.currentTime, buffer: outBuffer}
        done(null, outBuffer)
      })
    } else done(null, this._cachedBlock.buffer)
  }

})