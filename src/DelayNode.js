import AudioNode from './AudioNode.js'
import AudioParam from './AudioParam.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'
import { DOMErr } from './errors.js'

class DelayNode extends AudioNode {

  #delayTime
  #maxDelayTime
  #ringBuf    // per-channel ring buffers
  #writePos = 0

  get delayTime() { return this.#delayTime }
  get maxDelayTime() { return this.#maxDelayTime }

  constructor(context, options) {
    options = AudioNode._checkOpts(options)
    let maxDelayTime = options.maxDelayTime ?? 1.0
    super(context, 1, 1, undefined, 'max', 'speakers')
    if (typeof maxDelayTime !== 'number' || isNaN(maxDelayTime))
      throw new TypeError('maxDelayTime must be a valid number')
    if (maxDelayTime <= 0 || maxDelayTime >= 180)
      throw DOMErr('maxDelayTime must be in range (0, 180)', 'NotSupportedError')
    this.#maxDelayTime = maxDelayTime
    this.#delayTime = new AudioParam(this.context, options.delayTime ?? 0, 'a', 0, maxDelayTime)
    let ringLen = Math.ceil(maxDelayTime * context.sampleRate) + BLOCK_SIZE
    this.#ringBuf = []
    this._outBuf = null
    this._outCh = 0
    this._ringLen = ringLen
    this._ticking = false
    // Mark output as allowing cycles (DelayNode breaks cycles per spec)
    this._outputs[0]._allowsCycle = true
    this._applyOpts(options)
  }

  _ensureRingBuf(channels) {
    if (this.#ringBuf.length !== channels) {
      this.#ringBuf = []
      for (let ch = 0; ch < channels; ch++)
        this.#ringBuf.push(new Float32Array(this._ringLen))
      this.#writePos = 0
    }
  }

  _tick() {
    if (this._ticking) {
      // Re-entry in a feedback cycle: mark for delay clamping, return previous output
      this._inCycle = true
      if (this._outBuf) return this._outBuf
      return new AudioBuffer(1, BLOCK_SIZE, this.context.sampleRate)
    }
    this._ticking = true
    this._inCycle = false
    this.context._delayInCycle = (this.context._delayInCycle || 0) + 1
    super._tick()
    let inBuf = this._inputs[0]._tick()
    let ch = inBuf.numberOfChannels
    let sr = this.context.sampleRate
    let delayArr = this.#delayTime._tick()

    this._ensureRingBuf(ch)

    if (ch !== this._outCh) {
      this._outBuf = new AudioBuffer(ch, BLOCK_SIZE, sr)
      this._outCh = ch
    }

    let ringLen = this._ringLen
    let wp = this.#writePos

    // Spec: in a cycle, delay must be at least one render quantum
    let minDelay = this._inCycle ? BLOCK_SIZE / sr : 0

    for (let c = 0; c < ch; c++) {
      let ring = this.#ringBuf[c]
      let inp = inBuf.getChannelData(c)
      let out = this._outBuf.getChannelData(c)

      for (let i = 0; i < BLOCK_SIZE; i++) {
        ring[(wp + i) % ringLen] = inp[i]
        let d = delayArr[i]
        let delaySamples = Math.max(minDelay, Math.min(this.#maxDelayTime, d === d ? d : 0)) * sr
        let readPos = (wp + i - delaySamples + ringLen * 2) % ringLen
        let idx = Math.floor(readPos)
        let frac = readPos - idx
        out[i] = ring[idx % ringLen] * (1 - frac) + ring[(idx + 1) % ringLen] * frac
      }
    }

    this.#writePos = (wp + BLOCK_SIZE) % ringLen
    this.context._delayInCycle = (this.context._delayInCycle || 1) - 1
    this._ticking = false
    return this._outBuf
  }
}

export default DelayNode
