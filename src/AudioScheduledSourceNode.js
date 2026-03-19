import AudioNode from './AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'
import { DOMErr } from './errors.js'

class AudioScheduledSourceNode extends AudioNode {

  #onended = null
  get onended() { return this.#onended }
  set onended(fn) {
    if (this.#onended) this.removeEventListener('ended', this.#onended)
    this.#onended = fn
    if (fn) this.addEventListener('ended', fn)
  }

  constructor(context, numberOfInputs, numberOfOutputs, channelCount, channelCountMode, channelInterpretation) {
    super(context, numberOfInputs, numberOfOutputs, channelCount, channelCountMode, channelInterpretation)
    this._playing = false
    this._started = false
    this._startTime = -1
    this._stopTime = -1
    this._ended = false
    this._zeroBuf = new AudioBuffer(1, BLOCK_SIZE, context.sampleRate)
  }

  start(when = 0) {
    if (typeof when !== 'number' || isNaN(when) || !isFinite(when)) throw new TypeError('when must be a finite number')
    if (when < 0) throw new RangeError('when must be non-negative')
    if (this._started) throw DOMErr('start has already been called', 'InvalidStateError')
    this._started = true
    this._startTime = when
  }

  stop(when = 0) {
    if (typeof when !== 'number' || isNaN(when) || !isFinite(when)) throw new TypeError('when must be a finite number')
    if (when < 0) throw new RangeError('when must be non-negative')
    if (!this._started) throw DOMErr('cannot stop before start', 'InvalidStateError')
    this._stopTime = when
  }

  // hook for subclasses to initialize on start
  _onStart() {}

  // schedule ended event + dispose
  _scheduleEnded(delay = 0) {
    if (this._ended) return
    this._ended = true
    this._playing = false
    // use microtask to fire after current tick completes
    this._schedule('ended', this.context.currentTime + delay, () => {
      this.dispatchEvent(new Event('ended'))
    })
    this._schedule('kill', this.context.currentTime + delay, () => this[Symbol.dispose]())
  }

  _tick() {
    super._tick()
    if (this._ended) return this._zeroBuf

    let sr = this.context.sampleRate
    let blockStart = this.context.currentTime
    // Compute blockEnd from frame counter to avoid float precision drift
    let blockEnd = this.context._frame != null
      ? (this.context._frame + BLOCK_SIZE) / sr
      : blockStart + BLOCK_SIZE / sr

    // Not started yet
    if (!this._started || this._startTime >= blockEnd) return this._zeroBuf

    // Compute sub-sample-accurate start/stop offsets within this block.
    // Use fp-safe ceiling: if value is within 1e-8 of an integer, snap to it.
    let fpCeil = v => { let r = Math.round(v); return Math.abs(v - r) < 1e-8 ? r : Math.ceil(v) }
    let startSample = 0
    if (this._startTime > blockStart)
      startSample = fpCeil((this._startTime - blockStart) * sr)

    // If the source starts at/past the end of this block, defer to next quantum
    if (startSample >= BLOCK_SIZE) return this._zeroBuf

    // Check if we just crossed start boundary — initialize on first playing tick
    if (!this._playing) {
      this._playing = true
      this._onStart()
    }

    let stopSample = BLOCK_SIZE
    if (this._stopTime >= 0 && this._stopTime < blockEnd) {
      stopSample = Math.max(0, fpCeil((this._stopTime - blockStart) * sr))
      if (stopSample <= startSample) {
        this._scheduleEnded(0)
        return this._zeroBuf
      }
    }

    // Full block — fast path
    if (startSample === 0 && stopSample === BLOCK_SIZE)
      return this._dsp()

    // Partial block — tell DSP to produce only the active samples, then place at correct offset
    let activeSamples = stopSample - startSample
    this._activeBlockSize = activeSamples
    this._blockStartOffset = startSample
    let out = this._dsp()
    this._activeBlockSize = 0
    this._blockStartOffset = 0
    if (startSample > 0 || stopSample < BLOCK_SIZE) {
      let nch = out.numberOfChannels
      let partial = new AudioBuffer(nch, BLOCK_SIZE, sr)
      for (let ch = 0; ch < nch; ch++) {
        let src = out.getChannelData(ch)
        let dst = partial.getChannelData(ch)
        for (let i = 0; i < activeSamples; i++)
          dst[startSample + i] = src[i]
      }
      out = partial
    }

    // End of playback
    if (this._stopTime >= 0 && this._stopTime < blockEnd)
      this._scheduleEnded(0)

    return out
  }

  // subclasses override this
  _dsp() { return this._zeroBuf }
}

export default AudioScheduledSourceNode
