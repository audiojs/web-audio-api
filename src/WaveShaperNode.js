import AudioNode from './AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'

const OVERSAMPLES = ['none', '2x', '4x']

// Half-band lowpass FIR for oversampling (linear phase, 15 taps, unity DC gain)
const HB_RAW = [-0.0125, 0, 0.0625, 0, -0.1875, 0, 0.6375, 1, 0.6375, 0, -0.1875, 0, 0.0625, 0, -0.0125]
const HB_SUM = HB_RAW.reduce((a, b) => a + b, 0)
const HALFBAND = new Float32Array(HB_RAW.map(v => v / HB_SUM))
const HB_LEN = HALFBAND.length
const HB_CENTER = (HB_LEN - 1) / 2

class WaveShaperNode extends AudioNode {

  #curve = null
  #oversample = 'none'

  get curve() { return this.#curve }
  set curve(val) {
    if (val === null) { this.#curve = null; return }
    if (val instanceof Float32Array) {
      if (val.length < 2) throw new Error('curve must have at least 2 elements')
      this.#curve = val
      return
    }
    if (typeof val !== 'object' || typeof val.length !== 'number')
      throw new Error('curve must be a Float32Array, Array, or array-like')
    val = new Float32Array(val)
    if (val.length < 2) throw new Error('curve must have at least 2 elements')
    this.#curve = val
  }

  get oversample() { return this.#oversample }
  set oversample(val) {
    if (!OVERSAMPLES.includes(val)) return
    this.#oversample = val
  }

  constructor(context, options) {
    options = AudioNode._checkOpts(options)
    super(context, 1, 1, undefined, 'max', 'speakers')
    if (options.curve !== undefined) this.curve = options.curve
    if (options.oversample !== undefined) this.oversample = options.oversample
    this._outBuf = null
    this._outCh = 0
    this._applyOpts(options)
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
      for (let c = 0; c < ch; c++) {
        let inp = inBuf.getChannelData(c), out = this._outBuf.getChannelData(c)
        for (let i = 0; i < BLOCK_SIZE; i++) out[i] = inp[i]
      }
      return this._outBuf
    }

    let curve = this.#curve, len = curve.length
    let factor = this.#oversample === '4x' ? 4 : this.#oversample === '2x' ? 2 : 1

    for (let c = 0; c < ch; c++) {
      let inp = inBuf.getChannelData(c)
      let out = this._outBuf.getChannelData(c)

      if (factor === 1) {
        for (let i = 0; i < BLOCK_SIZE; i++)
          out[i] = shapeSample(inp[i], curve, len)
      } else {
        // upsample by chaining 2x stages
        let data = inp
        let dataLen = BLOCK_SIZE
        let stages = factor === 4 ? 2 : 1
        for (let s = 0; s < stages; s++) {
          let up = new Float32Array(dataLen * 2)
          for (let i = 0; i < dataLen; i++) up[i * 2] = data[i] * 2
          data = applyHalfband(up, dataLen * 2)
          dataLen *= 2
        }

        // apply curve at oversampled rate
        for (let i = 0; i < dataLen; i++)
          data[i] = shapeSample(data[i], curve, len)

        // downsample by chaining 2x stages
        for (let s = 0; s < stages; s++) {
          data = applyHalfband(data, dataLen)
          let down = new Float32Array(dataLen / 2)
          for (let i = 0; i < down.length; i++) down[i] = data[i * 2]
          data = down
          dataLen /= 2
        }

        for (let i = 0; i < BLOCK_SIZE; i++) out[i] = data[i]
      }
    }

    return this._outBuf
  }
}

// curve lookup with linear interpolation
function shapeSample(val, curve, len) {
  let x = (val + 1) * 0.5 * (len - 1)
  x = Math.max(0, Math.min(len - 1, x))
  let idx = Math.floor(x)
  let frac = x - idx
  return idx < len - 1
    ? curve[idx] * (1 - frac) + curve[idx + 1] * frac
    : curve[len - 1]
}

// apply half-band FIR filter (for 2x; applied twice for 4x)
function applyHalfband(data, n) {
  let out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let sum = 0
    for (let j = 0; j < HB_LEN; j++) {
      let k = i - HB_CENTER + j
      if (k >= 0 && k < n) sum += data[k] * HALFBAND[j]
    }
    out[i] = sum
  }
  return out
}

export default WaveShaperNode
