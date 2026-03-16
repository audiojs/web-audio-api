import { BLOCK_SIZE } from './constants.js'
import AudioNode from './AudioNode.js'
import AudioParam from './AudioParam.js'
import AudioBuffer from 'audio-buffer'


class AudioBufferSourceNode extends AudioNode {

  #playbackRate
  get playbackRate() { return this.#playbackRate }

  #onended = null
  get onended() { return this.#onended }
  set onended(fn) {
    if (this.#onended) this.removeEventListener('ended', this.#onended)
    this.#onended = fn
    if (fn) this.addEventListener('ended', fn)
  }

  constructor(context) {
    super(context, 0, 1, undefined, 'max', 'speakers')

    this.buffer = null
    this.loop = false
    this.loopStart = 0
    this.loopEnd = 0

    this.#playbackRate = new AudioParam(this.context, 1, 'a')

    this._cursor = 0
    this._cursorEnd = 0
    this._playing = false
    this._started = false
    this._offset = 0
    this._duration = 0
    this._zeroBuf = new AudioBuffer(1, BLOCK_SIZE, context.sampleRate)
  }

  _reinitPlayback() {
    let sr = this.context.sampleRate
    this._cursor = (this._offset ? this._offset : this.loopStart) * sr
    if (this._duration) this._cursorEnd = this._cursor + this._duration * sr
    else if (this.loopEnd) this._cursorEnd = this.loopEnd * sr
    else this._cursorEnd = this.buffer.length
  }

  start(when, offset, duration) {
    if (this._started) return
    this._started = true
    this._offset = offset || 0
    this._duration = duration || 0

    this._schedule('start', when, () => {
      if (!this.buffer) throw new Error('invalid buffer')
      this._playing = true
      this._reinitPlayback()
    })
  }

  stop(when) {
    this._schedule('stop', when, () => {
      this._playing = false
    })
  }

  _tick() {
    super._tick()
    if (!this._playing) return this._zeroBuf
    return this._dspPlayback()
  }

  _dspPlayback() {
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
      this._schedule('ended', this.context.currentTime + delay, () => {
        this.dispatchEvent(new Event('ended'))
      })
      this._schedule('kill', this.context.currentTime + delay, this[Symbol.dispose].bind(this))
    }

    this._cursor = cursorNext
    return out
  }

}

export default AudioBufferSourceNode
