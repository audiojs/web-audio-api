import AudioNode from './AudioNode.js'
import AudioParam from './AudioParam.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'
import { DOMErr } from './errors.js'
import * as biquad from 'digital-filter/iir/biquad.js'

const TYPES = ['lowpass', 'highpass', 'bandpass', 'lowshelf', 'highshelf', 'peaking', 'notch', 'allpass']

class BiquadFilterNode extends AudioNode {

  #frequency
  #detune
  #Q
  #gain
  #type = 'lowpass'
  #state // per-channel filter state: flat Float64Array [x1,x2,y1,y2, x1,x2,y1,y2, ...]

  get frequency() { return this.#frequency }
  get detune() { return this.#detune }
  get Q() { return this.#Q }
  get gain() { return this.#gain }

  get type() { return this.#type }
  set type(val) {
    if (!TYPES.includes(val)) return // WebIDL: silently ignore invalid enum values
    this.#type = val
  }

  constructor(context, options) {
    options = AudioNode._checkOpts(options)
    super(context, 1, 1, undefined, 'max', 'speakers')
    let nyquist = context.sampleRate / 2
    this.#frequency = new AudioParam(this.context, options.frequency ?? 350, 'a', 0, nyquist)
    this.#detune = new AudioParam(this.context, options.detune ?? 0, 'a', -153600, 153600)
    this.#Q = new AudioParam(this.context, options.Q ?? 1, 'a')
    let gainMax = Math.fround(Math.fround(40) * Math.fround(Math.log10(3.4028234663852886e38)))
    this.#gain = new AudioParam(this.context, options.gain ?? 0, 'a', undefined, gainMax)
    if (options.type !== undefined) this.type = options.type
    this.#state = null
    this._outBuf = null
    this._outCh = 0
    this._applyOpts(options)
  }

  getFrequencyResponse(frequencyHz, magResponse, phaseResponse) {
    if (!(frequencyHz instanceof Float32Array)) throw new TypeError('frequencyHz must be a Float32Array')
    if (!(magResponse instanceof Float32Array)) throw new TypeError('magResponse must be a Float32Array')
    if (!(phaseResponse instanceof Float32Array)) throw new TypeError('phaseResponse must be a Float32Array')
    if (magResponse.length < frequencyHz.length)
      throw DOMErr('magResponse length must be >= frequencyHz length', 'InvalidAccessError')
    if (phaseResponse.length < frequencyHz.length)
      throw DOMErr('phaseResponse length must be >= frequencyHz length', 'InvalidAccessError')
    let sr = this.context.sampleRate
    let freq = this.#frequency.value * (2 ** (this.#detune.value / 1200))
    let Q = this.#Q.value
    let gain = this.#gain.value
    let coeffs = BiquadFilterNode._coefficients(this.#type, freq, sr, Q, gain)

    let nyquist = sr / 2
    for (let i = 0; i < frequencyHz.length; i++) {
      if (frequencyHz[i] < 0 || frequencyHz[i] > nyquist) {
        magResponse[i] = NaN
        phaseResponse[i] = NaN
        continue
      }
      let { b0, b1, b2, a1, a2 } = coeffs
      let w = 2 * Math.PI * frequencyHz[i] / sr
      let cos_w = Math.cos(w), sin_w = Math.sin(w)
      let cos_2w = Math.cos(2 * w), sin_2w = Math.sin(2 * w)

      let numReal = b0 + b1 * cos_w + b2 * cos_2w
      let numImag = -(b1 * sin_w + b2 * sin_2w)
      let denReal = 1 + a1 * cos_w + a2 * cos_2w
      let denImag = -(a1 * sin_w + a2 * sin_2w)

      let denMagSq = denReal * denReal + denImag * denImag
      let realPart = (numReal * denReal + numImag * denImag) / denMagSq
      let imagPart = (numImag * denReal - numReal * denImag) / denMagSq

      magResponse[i] = Math.sqrt(realPart * realPart + imagPart * imagPart)
      phaseResponse[i] = Math.atan2(imagPart, realPart)
    }
  }

  _tick() {
    super._tick()
    let inBuf = this._inputs[0]._tick()
    let ch = inBuf.numberOfChannels
    let sr = this.context.sampleRate
    let freqArr = this.#frequency._tick()
    let detuneArr = this.#detune._tick()
    let qArr = this.#Q._tick()
    let gainArr = this.#gain._tick()

    if (ch !== this._outCh) {
      this._outBuf = new AudioBuffer(ch, BLOCK_SIZE, sr)
      this._outCh = ch
      this.#state = new Float64Array(ch * 4)  // [x1, x2, y1, y2] per channel
    }

    // fast path: if params are constant across block, compute coefficients once
    let isConst = freqArr[0] === freqArr[BLOCK_SIZE - 1]
      && detuneArr[0] === detuneArr[BLOCK_SIZE - 1]
      && qArr[0] === qArr[BLOCK_SIZE - 1]
      && gainArr[0] === gainArr[BLOCK_SIZE - 1]

    if (isConst) {
      let freq = freqArr[0] * (2 ** (detuneArr[0] / 1200))
      let { b0, b1, b2, a1, a2 } = BiquadFilterNode._coefficients(this.#type, freq, sr, qArr[0], gainArr[0])
      for (let c = 0; c < ch; c++) {
        let inp = inBuf.getChannelData(c), out = this._outBuf.getChannelData(c)
        let si = c * 4
        let x1 = this.#state[si], x2 = this.#state[si+1], y1 = this.#state[si+2], y2 = this.#state[si+3]
        for (let i = 0; i < BLOCK_SIZE; i++) {
          let x = inp[i]
          let y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
          x2 = x1; x1 = x; y2 = y1; y1 = y
          out[i] = y
        }
        this.#state[si] = x1; this.#state[si+1] = x2; this.#state[si+2] = y1; this.#state[si+3] = y2
      }
    } else {
      for (let c = 0; c < ch; c++) {
        let inp = inBuf.getChannelData(c), out = this._outBuf.getChannelData(c)
        let si = c * 4
        let x1 = this.#state[si], x2 = this.#state[si+1], y1 = this.#state[si+2], y2 = this.#state[si+3]
        for (let i = 0; i < BLOCK_SIZE; i++) {
          let freq = freqArr[i] * (2 ** (detuneArr[i] / 1200))
          let { b0, b1, b2, a1, a2 } = BiquadFilterNode._coefficients(this.#type, freq, sr, qArr[i], gainArr[i])
          let x = inp[i]
          let y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
          x2 = x1; x1 = x; y2 = y1; y1 = y
          out[i] = y
        }
        this.#state[si] = x1; this.#state[si+1] = x2; this.#state[si+2] = y1; this.#state[si+3] = y2
      }
    }

    return this._outBuf
  }

  // Web Audio spec coefficients — delegates to digital-filter biquad
  // with Q adaptation (lowpass/highpass use dB-based Q, shelves use S=1 slope)
  static _coefficients(type, f0, sr, Q, gain) {
    switch (type) {
      case 'lowpass':  return biquad.lowpass(f0, 10 ** (Q / 20), sr)
      case 'highpass': return biquad.highpass(f0, 10 ** (Q / 20), sr)
      case 'bandpass': return biquad.bandpass2(f0, Q, sr)
      case 'lowshelf': return biquad.lowshelf(f0, Math.SQRT1_2, sr, gain)
      case 'highshelf': return biquad.highshelf(f0, Math.SQRT1_2, sr, gain)
      case 'peaking':  return biquad.peaking(f0, Q, sr, gain)
      case 'notch':    return biquad.notch(f0, Q, sr)
      case 'allpass':  return biquad.allpass(f0, Q, sr)
    }
  }
}

export default BiquadFilterNode
