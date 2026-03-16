import AudioNode from './AudioNode.js'
import { BLOCK_SIZE } from './constants.js'

class AnalyserNode extends AudioNode {

  #fftSize = 2048
  #minDecibels = -100
  #maxDecibels = -30
  #smoothingTimeConstant = 0.8
  #timeBuf       // circular time-domain buffer
  #writePos = 0
  #prevSpectrum  // smoothed magnitude spectrum

  get fftSize() { return this.#fftSize }
  set fftSize(val) {
    if (val < 32 || val > 32768 || (val & (val - 1)) !== 0)
      throw new Error('fftSize must be power of 2 between 32 and 32768')
    this.#fftSize = val
    this.#timeBuf = new Float32Array(val)
    this.#prevSpectrum = new Float32Array(val / 2)
    this.#writePos = 0
  }

  get frequencyBinCount() { return this.#fftSize / 2 }

  get minDecibels() { return this.#minDecibels }
  set minDecibels(val) { this.#minDecibels = val }

  get maxDecibels() { return this.#maxDecibels }
  set maxDecibels(val) { this.#maxDecibels = val }

  get smoothingTimeConstant() { return this.#smoothingTimeConstant }
  set smoothingTimeConstant(val) { this.#smoothingTimeConstant = Math.max(0, Math.min(1, val)) }

  constructor(context) {
    super(context, 1, 1, undefined, 'max', 'speakers')
    this.#timeBuf = new Float32Array(this.#fftSize)
    this.#prevSpectrum = new Float32Array(this.#fftSize / 2)
  }

  _tick() {
    super._tick()
    let inBuf = this._inputs[0]._tick()
    // store time-domain data (mono — take channel 0)
    let ch0 = inBuf.getChannelData(0)
    let n = this.#fftSize
    for (let i = 0; i < BLOCK_SIZE; i++)
      this.#timeBuf[(this.#writePos + i) % n] = ch0[i]
    this.#writePos = (this.#writePos + BLOCK_SIZE) % n
    // passthrough
    return inBuf
  }

  getFloatTimeDomainData(array) {
    let n = this.#fftSize
    for (let i = 0; i < Math.min(array.length, n); i++)
      array[i] = this.#timeBuf[(this.#writePos + i) % n]
  }

  getByteTimeDomainData(array) {
    let n = this.#fftSize
    for (let i = 0; i < Math.min(array.length, n); i++) {
      let val = this.#timeBuf[(this.#writePos + i) % n]
      array[i] = Math.max(0, Math.min(255, Math.round((val + 1) * 128)))
    }
  }

  getFloatFrequencyData(array) {
    let spectrum = this._computeSpectrum()
    let n = Math.min(array.length, spectrum.length)
    for (let i = 0; i < n; i++)
      array[i] = spectrum[i] > 0 ? 20 * Math.log10(spectrum[i]) : -120
  }

  getByteFrequencyData(array) {
    let spectrum = this._computeSpectrum()
    let range = this.#maxDecibels - this.#minDecibels
    let n = Math.min(array.length, spectrum.length)
    for (let i = 0; i < n; i++) {
      let dB = spectrum[i] > 0 ? 20 * Math.log10(spectrum[i]) : -120
      let scaled = (dB - this.#minDecibels) / range
      array[i] = Math.max(0, Math.min(255, Math.round(scaled * 255)))
    }
  }

  _computeSpectrum() {
    let n = this.#fftSize
    let bins = n / 2

    // get ordered time-domain data
    let data = new Float32Array(n)
    for (let i = 0; i < n; i++)
      data[i] = this.#timeBuf[(this.#writePos + i) % n]

    // apply Blackman window
    for (let i = 0; i < n; i++) {
      let w = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / n) + 0.08 * Math.cos(4 * Math.PI * i / n)
      data[i] *= w
    }

    // radix-2 FFT
    let real = data
    let imag = new Float32Array(n)
    fft(real, imag, n)

    // compute magnitude spectrum with smoothing
    let smooth = this.#smoothingTimeConstant
    let prev = this.#prevSpectrum
    let spectrum = new Float32Array(bins)
    for (let i = 0; i < bins; i++) {
      let mag = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / n
      spectrum[i] = smooth * prev[i] + (1 - smooth) * mag
      prev[i] = spectrum[i]
    }

    return spectrum
  }
}

// In-place radix-2 Cooley-Tukey FFT
function fft(real, imag, n) {
  // bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    while (j & bit) { j ^= bit; bit >>= 1 }
    j ^= bit
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]]
    }
  }

  // butterfly stages
  for (let len = 2; len <= n; len *= 2) {
    let half = len / 2
    let angle = -2 * Math.PI / len
    let wR = Math.cos(angle), wI = Math.sin(angle)

    for (let i = 0; i < n; i += len) {
      let curR = 1, curI = 0
      for (let j = 0; j < half; j++) {
        let a = i + j, b = a + half
        let tR = curR * real[b] - curI * imag[b]
        let tI = curR * imag[b] + curI * real[b]
        real[b] = real[a] - tR; imag[b] = imag[a] - tI
        real[a] += tR; imag[a] += tI
        let tmpR = curR * wR - curI * wI
        curI = curR * wI + curI * wR
        curR = tmpR
      }
    }
  }
}

export default AnalyserNode
