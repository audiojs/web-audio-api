var  _ = require('underscore')
  , constants = require('./constants')
  , AudioNode = require('./AudioNode')
  , AudioParam = require('./AudioParam')
  , AudioBuffer = require('audiobuffer')
  , inherits = require('util').inherits
  , readOnlyAttr = require('./utils').readOnlyAttr

var AudioBufferSourceNode = module.exports = function(context) {
  AudioNode.call(this, context, 0, 1)
  this.channelCountMode = 'max'
  // TODO
  // should be speqkers
  this.channelInterpretation = 'discrete'

  this.buffer = null
  this.loop = false
  this.loopStart = 0
  this.loopEnd = 0

  readOnlyAttr(this, 'playbackRate', new AudioParam(this.context, 1, 'a'))

  this._dsp = this._dspZeros
}
inherits(AudioBufferSourceNode, AudioNode)

_.extend(AudioBufferSourceNode.prototype, {

  start: function(when, offset, duration) {
    var self = this
    this._schedule('start', when, function() {
      if (!self.buffer) throw new Error('invalid buffer')

      // keeps track of the current position in the buffer
      var blockSize = constants.BLOCK_SIZE
        , sampleRate = self.context.sampleRate
        , cursor, cursorEnd, cursorNext
        , missingFrames, outBuffer

      var reinitPlayback = function() {
        cursor = (offset ? offset : self.loopStart) * sampleRate
        if (duration) cursorEnd = cursor + duration * sampleRate
        else if (self.loopEnd) cursorEnd = self.loopEnd * sampleRate
        else cursorEnd = self.buffer.length
        cursorNext = cursor
      }
      reinitPlayback()

      self._dsp = function() {
        cursorNext = cursor + blockSize
        // If there's enough data left to be read in the buffer, just read it,
        // otherwise we need to handle things a bit differently
        if (cursorNext < cursorEnd) {
          outBuffer = self.buffer.slice(cursor, cursorNext)
          cursor = cursorNext
          return outBuffer
        } else {
          outBuffer = new AudioBuffer(self.buffer.numberOfChannels, blockSize, sampleRate)
          outBuffer.set(self.buffer.slice(cursor, cursorNext))
          // If looping, we must reinitialize our cursor variables.
          // If not looping, we free the node
          if (self.loop) {
            missingFrames = cursorNext - cursorEnd
            reinitPlayback()
            cursorNext = cursor + missingFrames
            outBuffer.set(self.buffer.slice(cursor, cursorNext), outBuffer.length - missingFrames)
          } else self._kill()
          cursor = cursorNext
          return outBuffer
        }
      }

    })
  },

  stop: function(when) {
    var self = this
    this._schedule('stop', when, function() {
      self._dsp = self._dspZeros
    })
  },

  _tick: function() {
    AudioNode.prototype._tick.apply(this, arguments)
    return this._dsp()
  },

  _dsp: function() {},

  _dspZeros: function() {
    return new AudioBuffer(1, constants.BLOCK_SIZE, this.context.sampleRate)
  }

})

/*
attribute EventHandler onended;
*/