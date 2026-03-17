import AudioNode from './AudioNode.js'
import { fft as computeFFT } from 'fourier-transform'
import { BLOCK_SIZE } from './constants.js'

class AnalyserNode extends AudioNode {

  #fftSize = 2048
  #minDecibels = -100
  #maxDecibels = -30
  #smoothingTimeConstant = 0.8
  #timeBuf       // circular time-domain buffer
  #writePos = 0
  #prevSpectrum  // smoothed magnitude spectrum
  #spectrum      // pre-allocated output
  #windowedBuf   // pre-allocated windowed input for FFT

  get fftSize() { return this.#fftSize }
  set fftSize(val) {
    if (val < 32 || val > 32768 || (val & (val - 1)) !== 0)
      throw new Error('fftSize must be power of 2 between 32 and 32768')
    this.#fftSize = val
    this._allocBuffers(val)
  }

  get frequencyBinCount() { return this.#fftSize / 2 }

  get minDecibels() { return this.#minDecibels }
  set minDecibels(val) {
    if (val >= this.#maxDecibels) throw new Error('minDecibels must be less than maxDecibels')
    this.#minDecibels = val
  }

  get maxDecibels() { return this.#maxDecibels }
  set maxDecibels(val) {
    if (val <= this.#minDecibels) throw new Error('maxDecibels must be greater than minDecibels')
    this.#maxDecibels = val
  }

  get smoothingTimeConstant() { return this.#smoothingTimeConstant }
  set smoothingTimeConstant(val) { this.#smoothingTimeConstant = Math.max(0, Math.min(1, val)) }

  constructor(context) {
    super(context, 1, 1, undefined, 'max', 'speakers')
    this._allocBuffers(this.#fftSize)
  }

  _allocBuffers(n) {
    this.#timeBuf = new Float32Array(n)
    this.#prevSpectrum = new Float64Array(n / 2)
    this.#spectrum = new Float64Array(n / 2)
    this.#windowedBuf = new Float64Array(n)
    this.#writePos = 0
  }

  _tick() {
    super._tick()
    let inBuf = this._inputs[0]._tick()
    let ch0 = inBuf.getChannelData(0)
    let n = this.#fftSize
    for (let i = 0; i < BLOCK_SIZE; i++)
      this.#timeBuf[(this.#writePos + i) % n] = ch0[i]
    this.#writePos = (this.#writePos + BLOCK_SIZE) % n
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
    let windowed = this.#windowedBuf

    // copy ordered time-domain data + apply Blackman window
    for (let i = 0; i < n; i++) {
      let w = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / n) + 0.08 * Math.cos(4 * Math.PI * i / n)
      windowed[i] = this.#timeBuf[(this.#writePos + i) % n] * w
    }

    // split-radix FFT → complex spectrum { re, im } with N/2+1 bins
    let [re, im] = computeFFT(windowed)

    // compute magnitude spectrum with smoothing
    let smooth = this.#smoothingTimeConstant
    let prev = this.#prevSpectrum
    let spectrum = this.#spectrum
    for (let i = 0; i < bins; i++) {
      let mag = Math.sqrt(re[i] * re[i] + im[i] * im[i]) / n
      spectrum[i] = smooth * prev[i] + (1 - smooth) * mag
      prev[i] = spectrum[i]
    }

    return spectrum
  }
}

export default AnalyserNode
