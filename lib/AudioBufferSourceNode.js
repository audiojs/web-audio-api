var  _ = require('underscore')
  , AudioNode = require('./AudioNode')
  , AudioParam = require('./AudioParam')
  , AudioBuffer = require('audiobuffer')
  , inherits = require('util').inherits
  , readOnlyAttr = require('./utils').readOnlyAttr

var AudioBufferSourceNode = module.exports = function(context) {
  AudioNode.call(this, context, 0, 1)

  this.buffer = null
  this.loop = false
  this.loopStart = 0
  this.loopEnd = 0

  readOnlyAttr(this, 'playbackRate', new AudioParam(this.context, 1, 'a'))
}
inherits(AudioBufferSourceNode, AudioNode)

_.extend(AudioBufferSourceNode.prototype, {

  start: function(when, offset, duration) {
    self = this
    this._schedule('start', when, function() {
      // keeps track of the current position in the buffer
      var blockSize = self.context.BLOCK_SIZE
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

      self._pullAudio = function(done) {
        cursorNext = cursor + blockSize
        // If there's enough data left to be read in the buffer, just read it,
        // otherwise we need to handle things a bit differently
        if (cursorNext < cursorEnd) {
          outBuffer = self.buffer.slice(cursor, cursorNext)
          cursor = cursorNext
          done(null, outBuffer)
        } else {
          outBuffer = new AudioBuffer(self.buffer.numberOfChannels, blockSize, sampleRate)
          outBuffer.set(self.buffer.slice(cursor, cursorNext))
          // If looping, we must reinitialize our cursor variables
          if (self.loop) {
            missingFrames = cursorNext - cursorEnd
            reinitPlayback()
            cursorNext = cursor + missingFrames
            outBuffer.set(self.buffer.slice(cursor, cursorNext), outBuffer.length - missingFrames)
          } else {
            self._pullAudio = function(done) {
              // We don't run _tick here, because in WAA this node doesn't work after having been used.
              done(null, new AudioBuffer(1, this.context.BLOCK_SIZE, this.context.sampleRate)) 
            }
          }
          cursor = cursorNext
          done(null, outBuffer)
        }
      }

    })
  },

  stop: function(when) {

  },

  pullAudio: function(done) {
    // We run tick first, in case 'start' is scheduled and changes the pullAudio
    // method
    this._tick()
    this._pullAudio(done)
  },

  _pullAudio: function(done) {
    done(null, new AudioBuffer(1, this.context.BLOCK_SIZE, this.context.sampleRate))     
  }

})

/*
attribute EventHandler onended;
*/