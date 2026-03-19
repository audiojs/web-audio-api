import AudioNode from './AudioNode.js'
import AudioParam from './AudioParam.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'
import { DOMErr } from './errors.js'

const TYPES = ['lowpass', 'highpass', 'bandpass', 'lowshelf', 'highshelf', 'peaking', 'notch', 'allpass']

class BiquadFilterNode extends AudioNode {

  #frequency
  #detune
  #Q
  #gain
  #type = 'lowpass'
  #state // per-channel filter state [x1, x2, y1, y2]

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
    this.#state = []
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
      this.#state = Array.from({ length: ch }, () => ({ x1: 0, x2: 0, y1: 0, y2: 0 }))
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
        let inp = inBuf.getChannelData(c), out = this._outBuf.getChannelData(c), s = this.#state[c]
        for (let i = 0; i < BLOCK_SIZE; i++) {
          let x = inp[i]
          let y = b0 * x + b1 * s.x1 + b2 * s.x2 - a1 * s.y1 - a2 * s.y2
          s.x2 = s.x1; s.x1 = x; s.y2 = s.y1; s.y1 = y
          out[i] = y
        }
      }
    } else {
      for (let c = 0; c < ch; c++) {
        let inp = inBuf.getChannelData(c), out = this._outBuf.getChannelData(c), s = this.#state[c]
        for (let i = 0; i < BLOCK_SIZE; i++) {
          let freq = freqArr[i] * (2 ** (detuneArr[i] / 1200))
          let { b0, b1, b2, a1, a2 } = BiquadFilterNode._coefficients(this.#type, freq, sr, qArr[i], gainArr[i])
          let x = inp[i]
          let y = b0 * x + b1 * s.x1 + b2 * s.x2 - a1 * s.y1 - a2 * s.y2
          s.x2 = s.x1; s.x1 = x; s.y2 = s.y1; s.y1 = y
          out[i] = y
        }
      }
    }

    return this._outBuf
  }

  // Web Audio spec coefficients — matches WPT reference (biquad-filters.js)
  // f0 in Hz, sr = sampleRate, Q = AudioParam value, gain in dB
  static _coefficients(type, f0, sr, Q, gain) {
    // Normalized frequency: 0 = DC, 1 = Nyquist
    let freq = f0 / (sr / 2)
    let b0, b1, b2, a0, a1, a2

    switch (type) {
      case 'lowpass': {
        if (freq >= 1) return { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 }
        if (freq <= 0) return { b0: 0, b1: 0, b2: 0, a1: 0, a2: 0 }
        let w0 = Math.PI * freq
        let alpha = Math.sin(w0) / (2 * Math.pow(10, Q / 20))
        let cosw = Math.cos(w0)
        let beta = (1 - cosw) / 2
        b0 = beta; b1 = 2 * beta; b2 = beta
        a0 = 1 + alpha; a1 = -2 * cosw; a2 = 1 - alpha
        break
      }
      case 'highpass': {
        if (freq >= 1) return { b0: 0, b1: 0, b2: 0, a1: 0, a2: 0 }
        if (freq <= 0) return { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 }
        let w0 = Math.PI * freq
        let alpha = Math.sin(w0) / (2 * Math.pow(10, Q / 20))
        let cosw = Math.cos(w0)
        let beta = (1 + cosw) / 2
        b0 = beta; b1 = -2 * beta; b2 = beta
        a0 = 1 + alpha; a1 = -2 * cosw; a2 = 1 - alpha
        break
      }
      case 'bandpass': {
        if (freq <= 0 || freq >= 1) return { b0: 0, b1: 0, b2: 0, a1: 0, a2: 0 }
        if (Q <= 0) return { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 }
        let w0 = Math.PI * freq
        let alpha = Math.sin(w0) / (2 * Q)
        let k = Math.cos(w0)
        b0 = alpha; b1 = 0; b2 = -alpha
        a0 = 1 + alpha; a1 = -2 * k; a2 = 1 - alpha
        break
      }
      case 'lowshelf': {
        let A = Math.pow(10, gain / 40)
        if (freq >= 1) return { b0: A * A, b1: 0, b2: 0, a1: 0, a2: 0 }
        if (freq <= 0) return { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 }
        let w0 = Math.PI * freq
        let S = 1
        let alpha = 0.5 * Math.sin(w0) * Math.sqrt((A + 1 / A) * (1 / S - 1) + 2)
        let k = Math.cos(w0)
        let k2 = 2 * Math.sqrt(A) * alpha
        let Ap1 = A + 1, Am1 = A - 1
        b0 = A * (Ap1 - Am1 * k + k2)
        b1 = 2 * A * (Am1 - Ap1 * k)
        b2 = A * (Ap1 - Am1 * k - k2)
        a0 = Ap1 + Am1 * k + k2
        a1 = -2 * (Am1 + Ap1 * k)
        a2 = Ap1 + Am1 * k - k2
        break
      }
      case 'highshelf': {
        let A = Math.pow(10, gain / 40)
        if (freq >= 1) return { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 }
        if (freq <= 0) return { b0: A * A, b1: 0, b2: 0, a1: 0, a2: 0 }
        let w0 = Math.PI * freq
        let S = 1
        let alpha = 0.5 * Math.sin(w0) * Math.sqrt((A + 1 / A) * (1 / S - 1) + 2)
        let k = Math.cos(w0)
        let k2 = 2 * Math.sqrt(A) * alpha
        let Ap1 = A + 1, Am1 = A - 1
        b0 = A * (Ap1 + Am1 * k + k2)
        b1 = -2 * A * (Am1 + Ap1 * k)
        b2 = A * (Ap1 + Am1 * k - k2)
        a0 = Ap1 - Am1 * k + k2
        a1 = 2 * (Am1 - Ap1 * k)
        a2 = Ap1 - Am1 * k - k2
        break
      }
      case 'peaking': {
        let A = Math.pow(10, gain / 40)
        if (freq <= 0 || freq >= 1) return { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 }
        if (Q <= 0) return { b0: A * A, b1: 0, b2: 0, a1: 0, a2: 0 }
        let w0 = Math.PI * freq
        let alpha = Math.sin(w0) / (2 * Q)
        let k = Math.cos(w0)
        b0 = 1 + alpha * A; b1 = -2 * k; b2 = 1 - alpha * A
        a0 = 1 + alpha / A; a1 = -2 * k; a2 = 1 - alpha / A
        break
      }
      case 'notch': {
        if (freq <= 0 || freq >= 1) return { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 }
        if (Q <= 0) return { b0: 0, b1: 0, b2: 0, a1: 0, a2: 0 }
        let w0 = Math.PI * freq
        let alpha = Math.sin(w0) / (2 * Q)
        let k = Math.cos(w0)
        b0 = 1; b1 = -2 * k; b2 = 1
        a0 = 1 + alpha; a1 = -2 * k; a2 = 1 - alpha
        break
      }
      case 'allpass': {
        if (freq <= 0 || freq >= 1) return { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 }
        if (Q <= 0) return { b0: -1, b1: 0, b2: 0, a1: 0, a2: 0 }
        let w0 = Math.PI * freq
        let alpha = Math.sin(w0) / (2 * Q)
        let k = Math.cos(w0)
        b0 = 1 - alpha; b1 = -2 * k; b2 = 1 + alpha
        a0 = 1 + alpha; a1 = -2 * k; a2 = 1 - alpha
        break
      }
    }

    let scale = 1 / a0
    return { b0: b0 * scale, b1: b1 * scale, b2: b2 * scale, a1: a1 * scale, a2: a2 * scale }
  }
}

export default BiquadFilterNode
