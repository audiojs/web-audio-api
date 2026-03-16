import AudioNode from './AudioNode.js'
import AudioParam from './AudioParam.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'

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
    if (!TYPES.includes(val)) throw new Error('Invalid filter type: ' + val)
    this.#type = val
  }

  constructor(context) {
    super(context, 1, 1, undefined, 'max', 'speakers')
    this.#frequency = new AudioParam(this.context, 350, 'a')
    this.#detune = new AudioParam(this.context, 0, 'a')
    this.#Q = new AudioParam(this.context, 1, 'a')
    this.#gain = new AudioParam(this.context, 0, 'a')
    this.#state = []
    this._outBuf = null
    this._outCh = 0
  }

  getFrequencyResponse(frequencyHz, magResponse, phaseResponse) {
    let sr = this.context.sampleRate
    let freq = this.#frequency.value
    let Q = this.#Q.value
    let gain = this.#gain.value
    // compute coefficients once for current node state
    let coeffs = BiquadFilterNode._coefficients(this.#type, freq, sr, Q, gain)

    for (let i = 0; i < frequencyHz.length; i++) {
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

    for (let c = 0; c < ch; c++) {
      let inp = inBuf.getChannelData(c)
      let out = this._outBuf.getChannelData(c)
      let s = this.#state[c]

      for (let i = 0; i < BLOCK_SIZE; i++) {
        let freq = freqArr[i] * (2 ** (detuneArr[i] / 1200))
        let { b0, b1, b2, a1, a2 } = BiquadFilterNode._coefficients(this.#type, freq, sr, qArr[i], gainArr[i])
        let x = inp[i]
        let y = b0 * x + b1 * s.x1 + b2 * s.x2 - a1 * s.y1 - a2 * s.y2
        s.x2 = s.x1; s.x1 = x
        s.y2 = s.y1; s.y1 = y
        out[i] = y
      }
    }

    return this._outBuf
  }

  // Audio EQ Cookbook coefficients (Robert Bristow-Johnson)
  static _coefficients(type, f0, sr, Q, gain) {
    let w0 = 2 * Math.PI * f0 / sr
    let cos_w0 = Math.cos(w0), sin_w0 = Math.sin(w0)
    let alpha = sin_w0 / (2 * Q)
    let A = Math.pow(10, gain / 40) // for shelving/peaking
    let b0, b1, b2, a0, a1, a2

    switch (type) {
      case 'lowpass':
        b0 = (1 - cos_w0) / 2; b1 = 1 - cos_w0; b2 = b0
        a0 = 1 + alpha; a1 = -2 * cos_w0; a2 = 1 - alpha
        break
      case 'highpass':
        b0 = (1 + cos_w0) / 2; b1 = -(1 + cos_w0); b2 = b0
        a0 = 1 + alpha; a1 = -2 * cos_w0; a2 = 1 - alpha
        break
      case 'bandpass':
        b0 = alpha; b1 = 0; b2 = -alpha
        a0 = 1 + alpha; a1 = -2 * cos_w0; a2 = 1 - alpha
        break
      case 'lowshelf':
        b0 = A * ((A + 1) - (A - 1) * cos_w0 + 2 * Math.sqrt(A) * alpha)
        b1 = 2 * A * ((A - 1) - (A + 1) * cos_w0)
        b2 = A * ((A + 1) - (A - 1) * cos_w0 - 2 * Math.sqrt(A) * alpha)
        a0 = (A + 1) + (A - 1) * cos_w0 + 2 * Math.sqrt(A) * alpha
        a1 = -2 * ((A - 1) + (A + 1) * cos_w0)
        a2 = (A + 1) + (A - 1) * cos_w0 - 2 * Math.sqrt(A) * alpha
        break
      case 'highshelf':
        b0 = A * ((A + 1) + (A - 1) * cos_w0 + 2 * Math.sqrt(A) * alpha)
        b1 = -2 * A * ((A - 1) + (A + 1) * cos_w0)
        b2 = A * ((A + 1) + (A - 1) * cos_w0 - 2 * Math.sqrt(A) * alpha)
        a0 = (A + 1) - (A - 1) * cos_w0 + 2 * Math.sqrt(A) * alpha
        a1 = 2 * ((A - 1) - (A + 1) * cos_w0)
        a2 = (A + 1) - (A - 1) * cos_w0 - 2 * Math.sqrt(A) * alpha
        break
      case 'peaking':
        b0 = 1 + alpha * A; b1 = -2 * cos_w0; b2 = 1 - alpha * A
        a0 = 1 + alpha / A; a1 = -2 * cos_w0; a2 = 1 - alpha / A
        break
      case 'notch':
        b0 = 1; b1 = -2 * cos_w0; b2 = 1
        a0 = 1 + alpha; a1 = -2 * cos_w0; a2 = 1 - alpha
        break
      case 'allpass':
        b0 = 1 - alpha; b1 = -2 * cos_w0; b2 = 1 + alpha
        a0 = 1 + alpha; a1 = -2 * cos_w0; a2 = 1 - alpha
        break
    }

    return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 }
  }
}

export default BiquadFilterNode
