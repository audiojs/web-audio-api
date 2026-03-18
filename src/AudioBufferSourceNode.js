import { BLOCK_SIZE } from './constants.js'
import AudioScheduledSourceNode from './AudioScheduledSourceNode.js'
import AudioNode from './AudioNode.js'
import AudioParam from './AudioParam.js'
import AudioBuffer from 'audio-buffer'
import { DOMErr } from './errors.js'

class AudioBufferSourceNode extends AudioScheduledSourceNode {

  #playbackRate
  get playbackRate() { return this.#playbackRate }
  #detune
  get detune() { return this.#detune }

  #buffer = null
  #bufferSet = false  // tracks if buffer was ever assigned a non-null value
  get buffer() { return this.#buffer }
  set buffer(val) {
    if (val !== null && !(val instanceof AudioBuffer))
      throw new TypeError('buffer must be an AudioBuffer or null')
    if (val !== null && this.#bufferSet)
      throw DOMErr('buffer can only be set once', 'InvalidStateError')
    if (val !== null) this.#bufferSet = true
    this.#buffer = val
  }

  constructor(context, options) {
    options = AudioNode._checkOpts(options)
    super(context, 0, 1, undefined, 'max', 'speakers')

    this.#buffer = options.buffer ?? null
    this.loop = options.loop ?? false
    this.loopStart = options.loopStart ?? 0
    this.loopEnd = options.loopEnd ?? 0

    this.#playbackRate = new AudioParam(this.context, options.playbackRate ?? 1, 'k')
    this.#playbackRate._fixedRate = true
    this.#detune = new AudioParam(this.context, options.detune ?? 0, 'k')
    this.#detune._fixedRate = true

    this._cursor = 0        // current position in buffer (samples)
    this._bufEnd = 0         // loop end or buffer end (samples)
    this._framesLeft = 0     // remaining frames from duration (0 = unlimited)
    this._offset = 0
    this._duration = 0
    this._applyOpts(options)
  }

  start(when, offset, duration) {
    if (offset !== undefined && offset < 0) throw new RangeError('offset must be non-negative')
    if (duration !== undefined && duration < 0) throw new RangeError('duration must be non-negative')
    this._offset = offset || 0
    this._duration = duration || 0
    super.start(when)
  }

  _onStart() {
    if (!this.buffer) throw new Error('invalid buffer')
    let sr = this.context.sampleRate
    this._cursor = Math.round(this._offset * sr)
    this._bufEnd = this.loopEnd > 0 ? Math.round(this.loopEnd * sr) : this.buffer.length
    this._framesLeft = this._duration > 0 ? Math.round(this._duration * sr) : 0
  }

  _dsp() {
    let sr = this.context.sampleRate
    let nch = this.buffer.numberOfChannels
    let bufLen = this.buffer.length
    let loopStart = this.loop && this.loopStart > 0 ? Math.round(this.loopStart * sr) : 0
    let blockSize = this._activeBlockSize || BLOCK_SIZE

    // Duration exhausted — silence
    if (this._duration > 0 && this._framesLeft <= 0)
      return new AudioBuffer(nch, blockSize, sr)

    // How many frames to produce this block
    let toWrite = blockSize
    if (this._framesLeft > 0) toWrite = Math.min(toWrite, this._framesLeft)

    // Fast path: entire block fits within buffer bounds, no loop crossing
    let cursorNext = this._cursor + toWrite
    if (cursorNext <= this._bufEnd && cursorNext <= bufLen) {
      if (this._framesLeft > 0) this._framesLeft -= toWrite
      if (toWrite === blockSize) {
        let out = this.buffer.slice(this._cursor, cursorNext)
        this._cursor = cursorNext
        if (this._framesLeft === 0 && this._duration > 0) this._scheduleEnded(0)
        return out
      }
      // Duration ends mid-block: partial output + silence
      let out = new AudioBuffer(nch, blockSize, sr)
      for (let ch = 0; ch < nch; ch++) {
        let src = this.buffer.getChannelData(ch)
        let dst = out.getChannelData(ch)
        for (let i = 0; i < toWrite; i++) dst[i] = src[this._cursor + i]
      }
      this._cursor = cursorNext
      this._scheduleEnded(0)
      return out
    }

    // Partial block: fill sample-by-sample handling loop wraps
    let out = new AudioBuffer(nch, blockSize, sr)
    let written = 0

    while (written < toWrite) {
      // Clamp read to buffer/loop end
      let end = Math.min(this._bufEnd, bufLen)
      let avail = end - this._cursor
      if (avail <= 0) {
        if (this.loop) {
          this._cursor = loopStart
          continue
        }
        break // non-loop: end of buffer
      }
      let count = Math.min(avail, toWrite - written)
      for (let ch = 0; ch < nch; ch++) {
        let src = this.buffer.getChannelData(ch)
        let dst = out.getChannelData(ch)
        for (let i = 0; i < count; i++) dst[written + i] = src[this._cursor + i]
      }
      written += count
      this._cursor += count

      if (this._cursor >= end && this.loop) {
        this._cursor = loopStart
      }
    }

    if (this._framesLeft > 0) {
      this._framesLeft -= toWrite
      if (this._framesLeft <= 0) this._scheduleEnded(0)
    } else if (!this.loop && written < blockSize) {
      this._scheduleEnded((blockSize - written) / sr)
    }

    return out
  }

}

export default AudioBufferSourceNode
