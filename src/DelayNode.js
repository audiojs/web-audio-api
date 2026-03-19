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
  #writtenFrames = 0  // total frames written to ring buffer
  #ringCh = 0         // channel count of data in ring buffer

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
      // When channel count changes, allocate new ring buffers.
      // Copy data from old buffers if possible.
      let old = this.#ringBuf
      this.#ringBuf = []
      for (let ch = 0; ch < channels; ch++) {
        let buf = new Float32Array(this._ringLen)
        if (ch < old.length) buf.set(old[ch])
        this.#ringBuf.push(buf)
      }
      this.#ringCh = channels
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
    let cycle = this.context._cycle || (this.context._cycle = { delayCount: 0, withoutDelay: false, detected: false, deferred: null })
    cycle.delayCount++
    // Track whether the cycle re-enters through an AudioOutput (not through this._tick re-entry)
    let prevCycleFlag = cycle.detected
    cycle.detected = false
    super._tick()
    let inBuf = this._inputs[0]._tick()

    // Detect cycle: either via delay._tick re-entry (_inCycle) or via AudioOutput re-entry
    if (!this._inCycle && cycle.detected) this._inCycle = true
    cycle.detected = prevCycleFlag

    let sr = this.context.sampleRate
    let delayArr = this.#delayTime._tick()
    let ch = inBuf.numberOfChannels

    this._ensureRingBuf(ch)

    // Spec: in a cycle, delay must be at least one render quantum
    let minDelay = this._inCycle ? BLOCK_SIZE / sr : 0

    // Determine output channel count: when reading from the ring buffer,
    // use the ring buffer's channel count if delayed data exists, else mono.
    // For write-then-read (non-cycle, including zero delay), output matches input.
    let d0 = delayArr[0]
    let delaySamples0 = Math.max(minDelay, Math.min(this.#maxDelayTime, d0 === d0 ? d0 : 0)) * sr
    let outCh
    if (this._inCycle) {
      // In a cycle, read-before-write: output depends on what's in the ring buffer
      outCh = this.#writtenFrames >= delaySamples0 ? this.#ringCh : 1
    } else {
      // Not in a cycle, write-before-read: current input data is available immediately
      outCh = this.#writtenFrames + BLOCK_SIZE > delaySamples0 ? ch : 1
    }

    if (outCh !== this._outCh) {
      this._outBuf = new AudioBuffer(outCh, BLOCK_SIZE, sr)
      this._outCh = outCh
    }

    let ringLen = this._ringLen
    let wp = this.#writePos

    if (this._inCycle) {
      // In a cycle: read from ring buffer first (output for this quantum),
      // then defer the write until after the cycle resolves with correct input.
      for (let c = 0; c < outCh; c++) {
        let ring = c < this.#ringBuf.length ? this.#ringBuf[c] : null
        let out = this._outBuf.getChannelData(c)
        for (let i = 0; i < BLOCK_SIZE; i++) {
          if (!ring) { out[i] = 0; continue }
          let d = delayArr[i]
          let delaySamples = Math.max(minDelay, Math.min(this.#maxDelayTime, d === d ? d : 0)) * sr
          let readPos = (wp + i - delaySamples + ringLen * 2) % ringLen
          let idx = Math.floor(readPos)
          let frac = readPos - idx
          out[i] = ring[idx % ringLen] * (1 - frac) + ring[(idx + 1) % ringLen] * frac
        }
      }
      // Defer ring buffer write — input from the cycle is stale;
      // _deferredWrite will re-pull and get the correct cached input
      if (!cycle.deferred) cycle.deferred = []
      cycle.deferred.push(this)
    } else {
      // Not in a cycle: write input then read (zero-delay passthrough works)
      for (let c = 0; c < ch; c++) {
        let ring = this.#ringBuf[c]
        let inp = inBuf.getChannelData(c)
        for (let i = 0; i < BLOCK_SIZE; i++) {
          ring[(wp + i) % ringLen] = inp[i]
        }
      }
      for (let c = 0; c < outCh; c++) {
        let ring = c < this.#ringBuf.length ? this.#ringBuf[c] : null
        let out = this._outBuf.getChannelData(c)
        for (let i = 0; i < BLOCK_SIZE; i++) {
          if (!ring) { out[i] = 0; continue }
          let d = delayArr[i]
          let delaySamples = Math.max(minDelay, Math.min(this.#maxDelayTime, d === d ? d : 0)) * sr
          let readPos = (wp + i - delaySamples + ringLen * 2) % ringLen
          let idx = Math.floor(readPos)
          let frac = readPos - idx
          out[i] = ring[idx % ringLen] * (1 - frac) + ring[(idx + 1) % ringLen] * frac
        }
      }
      this.#writePos = (wp + BLOCK_SIZE) % ringLen
      this.#writtenFrames += BLOCK_SIZE
    }

    cycle.delayCount--
    this._ticking = false
    return this._outBuf
  }

  // Called after the full graph pull resolves. Re-pull input (now correctly cached
  // by upstream nodes) and write it to the ring buffer.
  _deferredWrite() {
    let cycle = this.context._cycle || (this.context._cycle = { delayCount: 0, withoutDelay: false, detected: false, deferred: null })
    cycle.delayCount++
    let inBuf = this._inputs[0]._tick()
    let ch = inBuf.numberOfChannels
    let ringLen = this._ringLen
    let wp = this.#writePos

    this._ensureRingBuf(ch)

    for (let c = 0; c < ch; c++) {
      let ring = this.#ringBuf[c]
      let inp = inBuf.getChannelData(c)
      for (let i = 0; i < BLOCK_SIZE; i++) {
        ring[(wp + i) % ringLen] = inp[i]
      }
    }
    this.#writePos = (wp + BLOCK_SIZE) % ringLen
    this.#writtenFrames += BLOCK_SIZE
    cycle.delayCount--
  }
}

export default DelayNode
