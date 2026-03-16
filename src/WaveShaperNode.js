import AudioNode from './AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'

const OVERSAMPLES = ['none', '2x', '4x']

class WaveShaperNode extends AudioNode {

  #curve = null
  #oversample = 'none'

  get curve() { return this.#curve }
  set curve(val) {
    if (val !== null && !(val instanceof Float32Array))
      throw new Error('curve must be Float32Array or null')
    this.#curve = val
  }

  get oversample() { return this.#oversample }
  set oversample(val) {
    if (!OVERSAMPLES.includes(val)) throw new Error('Invalid oversample: ' + val)
    this.#oversample = val
  }

  constructor(context) {
    super(context, 1, 1, undefined, 'max', 'speakers')
    this._outBuf = null
    this._outCh = 0
  }

  _tick() {
    super._tick()
    let inBuf = this._inputs[0]._tick()
    let ch = inBuf.numberOfChannels

    if (ch !== this._outCh) {
      this._outBuf = new AudioBuffer(ch, BLOCK_SIZE, this.context.sampleRate)
      this._outCh = ch
    }

    if (!this.#curve) {
      // passthrough
      for (let c = 0; c < ch; c++) {
        let inp = inBuf.getChannelData(c), out = this._outBuf.getChannelData(c)
        for (let i = 0; i < BLOCK_SIZE; i++) out[i] = inp[i]
      }
    } else {
      let curve = this.#curve, len = curve.length
      for (let c = 0; c < ch; c++) {
        let inp = inBuf.getChannelData(c), out = this._outBuf.getChannelData(c)
        for (let i = 0; i < BLOCK_SIZE; i++) {
          // map [-1, 1] → [0, len-1] with linear interpolation
          let x = (inp[i] + 1) * 0.5 * (len - 1)
          x = Math.max(0, Math.min(len - 1, x))
          let idx = Math.floor(x)
          let frac = x - idx
          out[i] = idx < len - 1
            ? curve[idx] * (1 - frac) + curve[idx + 1] * frac
            : curve[len - 1]
        }
      }
    }

    return this._outBuf
  }
}

export default WaveShaperNode
