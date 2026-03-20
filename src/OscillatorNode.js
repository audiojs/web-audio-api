import AudioScheduledSourceNode from './AudioScheduledSourceNode.js'
import AudioNode from './AudioNode.js'
import AudioParam from './AudioParam.js'
import AudioBuffer from 'audio-buffer'
import PeriodicWave, { TABLE_SIZE } from './PeriodicWave.js'

const MASK = TABLE_SIZE - 1  // 8191 — TABLE_SIZE is 8192 = 2^13, so modulo = bitwise AND
import { BLOCK_SIZE } from './constants.js'
import { DOMErr } from './errors.js'

const TYPES = ['sine', 'square', 'sawtooth', 'triangle', 'custom']

class OscillatorNode extends AudioScheduledSourceNode {

  #frequency
  #detune
  #type = 'sine'
  #periodicWave = null
  #phase = 0

  get frequency() { return this.#frequency }
  get detune() { return this.#detune }

  get type() { return this.#type }
  set type(val) {
    if (!TYPES.includes(val)) return // WebIDL: silently ignore invalid enum values
    if (val === 'custom') throw DOMErr('Cannot set type to custom; use setPeriodicWave()', 'InvalidStateError')
    this.#type = val
    this.#periodicWave = null
  }

  constructor(context, options) {
    options = AudioNode._checkOpts(options)
    super(context, 0, 1, undefined, 'max', 'speakers')
    let nyquist = context.sampleRate / 2
    this.#frequency = new AudioParam(this.context, options.frequency ?? 440, 'a', -nyquist, nyquist)
    this.#detune = new AudioParam(this.context, options.detune ?? 0, 'a', -153600, 153600)
    if ('periodicWave' in options) this.setPeriodicWave(options.periodicWave)
    else if (options.type !== undefined) this.type = options.type
    this._outBuf = new AudioBuffer(1, BLOCK_SIZE, context.sampleRate)
    this._applyOpts(options)
  }

  setPeriodicWave(wave) {
    if (!(wave instanceof PeriodicWave)) throw new TypeError('Expected PeriodicWave')
    this.#periodicWave = wave
    this.#type = 'custom'
  }

  _dsp(offset, count) {
    let freqArr = this.#frequency._tick()
    let detuneArr = this.#detune._tick()
    let out = this._outBuf.getChannelData(0)
    let sr = this.context.sampleRate
    let nyquist = sr / 2
    let table = this.#periodicWave?.table ?? PeriodicWave.getBuiltIn(this.#type)
    let phase = this.#phase

    // Advance phase for skipped samples (before start within block)
    for (let i = 0; i < offset; i++) {
      phase += freqArr[i] * (2 ** (detuneArr[i] / 1200)) / sr
      phase -= Math.floor(phase)
    }

    // Fast path: constant frequency and detune across block — compute once
    if (freqArr[0] === freqArr[BLOCK_SIZE - 1] && detuneArr[0] === detuneArr[BLOCK_SIZE - 1]) {
      let freq = freqArr[0] * (2 ** (detuneArr[0] / 1200))
      if (Math.abs(freq) >= nyquist) {
        out.fill(0, 0, count)
        phase += freq / sr * count
        phase -= Math.floor(phase)
      } else {
        let phaseInc = freq / sr
        for (let i = 0; i < count; i++) {
          let pos = phase * TABLE_SIZE
          let idx = pos | 0  // pos ∈ [0, TABLE_SIZE) since phase ∈ [0, 1)
          let frac = pos - idx
          let y0 = table[(idx + MASK) & MASK]  // idx - 1, wrapping
          let y1 = table[idx]
          let y2 = table[(idx + 1) & MASK]
          let y3 = table[(idx + 2) & MASK]
          let c0 = y1
          let c1 = 0.5 * (y2 - y0)
          let c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3
          let c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2)
          out[i] = ((c3 * frac + c2) * frac + c1) * frac + c0
          phase += phaseInc
          if (phase >= 1) phase -= 1
          else if (phase < 0) phase += 1
        }
      }
    } else {
      // Variable frequency — per-sample computation
      for (let i = 0; i < count; i++) {
        let freq = freqArr[offset + i] * (2 ** (detuneArr[offset + i] / 1200))

        // Per spec: if computed frequency >= Nyquist, output silence
        if (Math.abs(freq) >= nyquist) {
          out[i] = 0
          phase += freq / sr
          phase -= Math.floor(phase)
          continue
        }

        let pos = phase * TABLE_SIZE
        let idx = pos | 0  // pos ∈ [0, TABLE_SIZE) since phase ∈ [0, 1)
        let frac = pos - idx
        let y0 = table[(idx + MASK) & MASK]  // idx - 1, wrapping
        let y1 = table[idx]
        let y2 = table[(idx + 1) & MASK]
        let y3 = table[(idx + 2) & MASK]
        let c0 = y1
        let c1 = 0.5 * (y2 - y0)
        let c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3
        let c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2)
        out[i] = ((c3 * frac + c2) * frac + c1) * frac + c0

        phase += freq / sr
        phase -= Math.floor(phase)
      }
    }
    // Zero remaining samples if producing less than BLOCK_SIZE
    for (let i = count; i < BLOCK_SIZE; i++) out[i] = 0

    this.#phase = phase
    return this._outBuf
  }
}

export default OscillatorNode
