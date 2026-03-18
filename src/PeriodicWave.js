// PeriodicWave — custom waveforms for OscillatorNode
// Stores wavetable generated from Fourier coefficients (W3C spec convention)
import { DOMErr } from './errors.js'

export const TABLE_SIZE = 8192

class PeriodicWave {
  #real
  #imag
  #table
  #disableNormalization

  constructor(contextOrReal, optionsOrImag, constraints) {
    let real, imag, disableNormalization = false

    // Spec constructor: new PeriodicWave(context, {real, imag, disableNormalization})
    if (contextOrReal && typeof contextOrReal === 'object' && 'sampleRate' in contextOrReal) {
      let opts = optionsOrImag || {}
      real = opts.real
      imag = opts.imag
      disableNormalization = opts.disableNormalization ?? false
      // Per spec: if only real is given, imag defaults to zeros; if only imag, real defaults to zeros
      if (real && !imag) imag = new Float32Array(real.length)
      if (imag && !real) real = new Float32Array(imag.length)
    } else {
      // Legacy: new PeriodicWave(real, imag, {disableNormalization})
      real = contextOrReal
      imag = optionsOrImag
      disableNormalization = constraints?.disableNormalization ?? false
    }

    if (!real || !imag) throw new TypeError('real and imag are required')
    if (real.length !== imag.length) throw DOMErr('real and imag must have equal length', 'IndexSizeError')
    if (real.length < 2) throw DOMErr('real and imag must have at least 2 elements', 'IndexSizeError')
    for (let i = 0; i < real.length; i++)
      if (!isFinite(real[i])) throw new TypeError('real values must be finite')
    for (let i = 0; i < imag.length; i++)
      if (!isFinite(imag[i])) throw new TypeError('imag values must be finite')

    this.#real = Float32Array.from(real)
    this.#imag = Float32Array.from(imag)
    this.#disableNormalization = disableNormalization
    this.#table = PeriodicWave.buildTable(this.#real, this.#imag, disableNormalization)
  }

  get table() { return this.#table }

  // W3C spec: x(n) = Σ [ real[k] * cos(2πkn/N) + imag[k] * sin(2πkn/N) ]
  static buildTable(real, imag, disableNormalization = false) {
    let n = real.length
    let table = new Float32Array(TABLE_SIZE)

    for (let t = 0; t < TABLE_SIZE; t++) {
      let phase = (t / TABLE_SIZE) * 2 * Math.PI
      let val = 0
      for (let k = 0; k < n; k++)
        val += real[k] * Math.cos(k * phase) + imag[k] * Math.sin(k * phase)
      table[t] = val
    }

    if (!disableNormalization) {
      let max = 0
      for (let i = 0; i < TABLE_SIZE; i++) max = Math.max(max, Math.abs(table[i]))
      if (max > 0) for (let i = 0; i < TABLE_SIZE; i++) table[i] /= max
    }

    return table
  }

  static _builtIn = {}

  static getBuiltIn(type) {
    if (this._builtIn[type]) return this._builtIn[type]

    let n = 64
    let real = new Float32Array(n)
    let imag = new Float32Array(n)

    switch (type) {
      case 'sine':
        // sin(t) = imag[1] * sin(t) → imag[1] = 1
        imag[1] = 1
        break
      case 'square':
        // odd harmonics: 4/(πk) * sin(kt) → imag[k] = 4/(πk)
        for (let k = 1; k < n; k += 2) imag[k] = 4 / (Math.PI * k)
        break
      case 'sawtooth':
        // Σ (-1)^(k+1) * 2/(πk) * sin(kt) → imag[k] = (-1)^(k+1) * 2/(πk)
        for (let k = 1; k < n; k++) imag[k] = (k % 2 ? 1 : -1) * 2 / (Math.PI * k)
        break
      case 'triangle':
        // odd harmonics: 8/(π²k²) * (-1)^m * sin(kt), m = (k-1)/2
        for (let k = 1; k < n; k += 2) {
          let m = (k - 1) / 2
          imag[k] = (8 / (Math.PI * Math.PI * k * k)) * (m % 2 ? -1 : 1)
        }
        break
      default:
        throw new Error('Unknown waveform type: ' + type)
    }

    this._builtIn[type] = PeriodicWave.buildTable(real, imag, true)
    return this._builtIn[type]
  }
}

export default PeriodicWave
