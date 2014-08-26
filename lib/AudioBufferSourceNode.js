var constants = require('./constants')
  , AudioNode = require('./AudioNode')
  , AudioParam = require('./AudioParam')
  , AudioBuffer = require('./AudioBuffer')
  , readOnlyAttr = require('./utils').readOnlyAttr


class AudioBufferSourceNode extends AudioNode {

  constructor(context) {
    super(context, 0, 1, undefined, 'max', 'speakers')

    this.buffer = null
    this.loop = false
    this.loopStart = 0
    this.loopEnd = 0

    readOnlyAttr(this, 'playbackRate', new AudioParam(this.context, 1, 'a'))

    this._dsp = this._dspZeros
  }

  start(when, offset, duration) {
    this._schedule('start', when, () => {
      if (!this.buffer) throw new Error('invalid buffer')

      // Subsequent calls to `start` have no effect
      this.start = function() {}

      // keeps track of the current position in the buffer
      var blockSize = constants.BLOCK_SIZE,
        sampleRate = this.context.sampleRate,
        cursor, cursorEnd, cursorNext, missingFrames, outBuffer

      var reinitPlayback = () => {
        cursor = (offset ? offset : this.loopStart) * sampleRate
        if (duration) cursorEnd = cursor + duration * sampleRate
        else if (this.loopEnd) cursorEnd = this.loopEnd * sampleRate
        else cursorEnd = this.buffer.length
        cursorNext = cursor
      }
      reinitPlayback()

      this._dsp = function() {
        cursorNext = cursor + blockSize
        // If there's enough data left to be read in the buffer, just read it,
        // otherwise we need to handle things a bit differently
        if (cursorNext < cursorEnd) {
          outBuffer = this.buffer.slice(cursor, cursorNext)
          cursor = cursorNext
          return outBuffer
        } else {
          outBuffer = new AudioBuffer(this.buffer.numberOfChannels, blockSize, sampleRate)
          outBuffer.set(this.buffer.slice(cursor, cursorNext))
          // If looping, we must reinitialize our cursor variables.
          // If not looping, we free the node
          if (this.loop) {
            missingFrames = cursorNext - cursorEnd
            reinitPlayback()
            cursorNext = cursor + missingFrames
            outBuffer.set(this.buffer.slice(cursor, cursorNext), outBuffer.length - missingFrames)
          } else {
            if (this.onended) {
              this._schedule('onended', this.context.currentTime + (cursorNext - cursorEnd) / sampleRate, this.onended)
            }
            this._schedule('kill', this.context.currentTime + (cursorNext - cursorEnd) / sampleRate, this._kill.bind(this))
          }
          cursor = cursorNext
          return outBuffer
        }
      }

    })
  }

  stop(when) {
    this._schedule('stop', when, () => {
      this._dsp = this._dspZeros
    })
  }

  onended() {}

  _tick() {
    super._tick(arguments)
    return this._dsp()
  }

  _dsp() {}

  _dspZeros() {
    return new AudioBuffer(1, constants.BLOCK_SIZE, this.context.sampleRate)
  }

}

module.exports = AudioBufferSourceNode
