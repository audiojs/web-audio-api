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
    if (val !== null) {
      this.#bufferSet = true
      // Spec: "acquire the content" — copy buffer data so external mutations don't affect playback.
      // Also replace the original buffer's internal channel arrays so that getChannelData
      // returns the acquired snapshot (detached from any prior Float32Array references).
      let nch = val.numberOfChannels, len = val.length
      let copy = new AudioBuffer(nch, len, val.sampleRate)
      for (let c = 0; c < nch; c++) {
        let snapshot = new Float32Array(val.getChannelData(c))
        copy.getChannelData(c).set(snapshot)
        // Replace original buffer's channel with a fresh copy of the snapshot
        if (val._channels) val._channels[c] = new Float32Array(snapshot)
      }
      this.#buffer = copy
    } else {
      this.#buffer = null
    }
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
    if (!this.buffer) return // no buffer yet — will initialize when buffer is set later
    let bufSr = this.buffer.sampleRate
    // Cursor is in buffer-sample space (fractional)
    this._cursor = this._offset * bufSr
    this._bufEnd = this.loopEnd > 0 ? this.loopEnd * bufSr : this.buffer.length
    this._framesLeft = this._duration > 0 ? Math.round(this._duration * this.context.sampleRate) : 0

    // Compute sub-sample start offset: how far past the integer output frame
    // the actual start time falls. This is used to offset the initial cursor.
    let sr = this.context.sampleRate
    let startFrame = this._startTime * sr
    let fpCeil = v => { let r = Math.round(v); return Math.abs(v - r) < 1e-8 ? r : Math.ceil(v) }
    let firstOutputFrame = fpCeil(startFrame)
    let subSampleOffset = firstOutputFrame - startFrame // how far past the start
    // Snap tiny offsets to zero to avoid fp noise causing an extra sample
    if (Math.abs(subSampleOffset) < 1e-8) subSampleOffset = 0
    this._cursor += subSampleOffset * (bufSr / sr) * (this.#playbackRate.value || 0)
  }

  _dsp() {
    if (!this.buffer) return this._zeroBuf // no buffer assigned yet
    // Lazy init: if buffer was set after start(), initialize playback now
    if (this._bufEnd === 0 && this.buffer) this._onStart()
    let sr = this.context.sampleRate
    let bufSr = this.buffer.sampleRate
    let nch = this.buffer.numberOfChannels
    let bufLen = this.buffer.length
    let loopStart = this.loop && this.loopStart > 0 ? this.loopStart * bufSr : 0
    let blockSize = this._activeBlockSize || BLOCK_SIZE

    // Duration exhausted — silence
    if (this._duration > 0 && this._framesLeft <= 0)
      return new AudioBuffer(nch, blockSize, sr)

    // Compute effective playback step per output sample:
    // accounts for buffer resampling, playbackRate, and detune
    let rate = this.#playbackRate._tick()[0]
    let detune = this.#detune._tick()[0]
    let step = (bufSr / sr) * rate * Math.pow(2, detune / 1200)

    // How many output frames to produce this block
    let toWrite = blockSize
    if (this._framesLeft > 0) toWrite = Math.min(toWrite, this._framesLeft)

    let out = new AudioBuffer(nch, blockSize, sr)
    let written = 0
    let cursor = this._cursor
    let end = Math.min(this._bufEnd, bufLen)

    while (written < toWrite) {
      // playbackRate 0: sample-and-hold — don't advance cursor
      if (step === 0) {
        let idx = Math.floor(cursor)
        if (idx < 0) idx = 0
        if (idx >= bufLen) idx = bufLen - 1
        let val = (idx >= 0 && idx < bufLen) ? 1 : 0
        for (let ch = 0; ch < nch; ch++) {
          let src = this.buffer.getChannelData(ch)
          let dst = out.getChannelData(ch)
          let s = idx >= 0 && idx < bufLen ? src[idx] : 0
          for (let i = written; i < toWrite; i++) dst[i] = s
        }
        written = toWrite
        break
      }

      if (cursor >= end) {
        if (this.loop) {
          cursor = loopStart + ((cursor - end) % Math.max(1, end - loopStart))
          continue
        }
        break // non-loop: end of buffer
      }

      // Linear interpolation read at fractional cursor position
      let idx = Math.floor(cursor)
      let frac = cursor - idx
      for (let ch = 0; ch < nch; ch++) {
        let srcData = this.buffer.getChannelData(ch)
        let dst = out.getChannelData(ch)
        let s0 = idx >= 0 && idx < bufLen ? srcData[idx] : 0
        let s1
        if (idx + 1 < bufLen) {
          s1 = srcData[idx + 1]
        } else if (idx > 0 && idx < bufLen) {
          // Extrapolate past buffer end using last two samples
          s1 = 2 * srcData[idx] - srcData[idx - 1]
        } else {
          s1 = 0
        }
        dst[written] = s0 + (s1 - s0) * frac
      }
      written++
      cursor += step
    }

    this._cursor = cursor

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
