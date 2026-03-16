import AudioNode from './AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'

class ConvolverNode extends AudioNode {

  #buffer = null
  #normalize = true
  #irChannels = null // preprocessed IR channel data
  #overlapBuf = null // overlap-save state per output channel

  get buffer() { return this.#buffer }
  set buffer(val) {
    this.#buffer = val
    this.#overlapBuf = null
    if (val) {
      let nch = val.numberOfChannels
      this.#irChannels = []
      for (let c = 0; c < nch; c++) {
        let data = val.getChannelData(c)
        if (this.#normalize) {
          let sum = 0
          for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
          let rms = Math.sqrt(sum / data.length)
          if (rms > 0) {
            data = new Float32Array(data)
            let scale = 1 / rms
            for (let i = 0; i < data.length; i++) data[i] *= scale
          }
        }
        this.#irChannels.push(data)
      }
    } else {
      this.#irChannels = null
    }
  }

  get normalize() { return this.#normalize }
  set normalize(val) { this.#normalize = !!val }

  constructor(context) {
    super(context, 1, 1, undefined, 'clamped-max', 'speakers')
    this._outBuf = null
    this._outCh = 0
  }

  _tick() {
    super._tick()
    let inBuf = this._inputs[0]._tick()
    let inCh = inBuf.numberOfChannels

    if (!this.#irChannels) {
      // passthrough
      return inBuf
    }

    let irCh = this.#irChannels.length
    let irLen = this.#irChannels[0].length
    // output channels: max(inCh, irCh) capped at 2 for stereo convolution
    let outCh = Math.max(inCh, irCh)

    if (outCh !== this._outCh) {
      this._outBuf = new AudioBuffer(outCh, BLOCK_SIZE, this.context.sampleRate)
      this._outCh = outCh
    }

    // lazy init overlap buffer (accumulates tail from previous blocks)
    if (!this.#overlapBuf || this.#overlapBuf.length !== outCh) {
      this.#overlapBuf = Array.from({ length: outCh }, () => new Float32Array(irLen + BLOCK_SIZE))
    }

    // shift overlap buffers left by BLOCK_SIZE
    for (let c = 0; c < outCh; c++) {
      let ob = this.#overlapBuf[c]
      ob.copyWithin(0, BLOCK_SIZE)
      ob.fill(0, ob.length - BLOCK_SIZE)
    }

    // time-domain convolution: accumulate into overlap buffer
    for (let oc = 0; oc < outCh; oc++) {
      let ir = this.#irChannels[Math.min(oc, irCh - 1)]
      let inp = inBuf.getChannelData(Math.min(oc, inCh - 1))
      let ob = this.#overlapBuf[oc]

      for (let i = 0; i < BLOCK_SIZE; i++) {
        let x = inp[i]
        if (x === 0) continue
        for (let j = 0; j < irLen; j++)
          ob[i + j] += x * ir[j]
      }
    }

    // read first BLOCK_SIZE samples from each overlap buffer
    for (let c = 0; c < outCh; c++) {
      let out = this._outBuf.getChannelData(c)
      let ob = this.#overlapBuf[c]
      for (let i = 0; i < BLOCK_SIZE; i++) out[i] = ob[i]
    }

    return this._outBuf
  }
}

export default ConvolverNode
