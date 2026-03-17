import { BLOCK_SIZE } from './constants.js'
import AudioScheduledSourceNode from './AudioScheduledSourceNode.js'
import AudioNode from './AudioNode.js'
import AudioParam from './AudioParam.js'
import AudioBuffer from 'audio-buffer'


class AudioBufferSourceNode extends AudioScheduledSourceNode {

  #playbackRate
  get playbackRate() { return this.#playbackRate }

  constructor(context, options) {
    options = AudioNode._checkOpts(options)
    super(context, 0, 1, undefined, 'max', 'speakers')

    this.buffer = options.buffer ?? null
    this.loop = options.loop ?? false
    this.loopStart = options.loopStart ?? 0
    this.loopEnd = options.loopEnd ?? 0

    this.#playbackRate = new AudioParam(this.context, options.playbackRate ?? 1, 'a')

    this._cursor = 0
    this._cursorEnd = 0
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
    this._reinitPlayback()
  }

  _reinitPlayback() {
    let sr = this.context.sampleRate
    this._cursor = (this._offset ? this._offset : this.loopStart) * sr
    if (this._duration) this._cursorEnd = this._cursor + this._duration * sr
    else if (this.loopEnd) this._cursorEnd = this.loopEnd * sr
    else this._cursorEnd = this.buffer.length
  }

  _dsp() {
    let cursorNext = this._cursor + BLOCK_SIZE
    let sr = this.context.sampleRate

    if (cursorNext < this._cursorEnd) {
      let out = this.buffer.slice(this._cursor, cursorNext)
      this._cursor = cursorNext
      return out
    }

    let out = new AudioBuffer(this.buffer.numberOfChannels, BLOCK_SIZE, sr)
    let remaining = Math.min(cursorNext, this._cursorEnd) - this._cursor
    if (remaining > 0)
      out.set(this.buffer.slice(this._cursor, this._cursor + remaining))

    if (this.loop) {
      let missing = cursorNext - this._cursorEnd
      this._reinitPlayback()
      cursorNext = this._cursor + missing
      out.set(this.buffer.slice(this._cursor, cursorNext), out.length - missing)
    } else {
      let delay = (cursorNext - this._cursorEnd) / sr
      this._scheduleEnded(delay)
    }

    this._cursor = cursorNext
    return out
  }

}

export default AudioBufferSourceNode
