import AudioNode from './AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'
import { DOMErr } from './errors.js'

class ConvolverNode extends AudioNode {

  #buffer = null
  #normalize = true
  #irChannels = null // preprocessed IR channel data
  #overlapBuf = null // overlap-save state per output channel

  get buffer() { return this.#buffer }
  set buffer(val) {
    if (val !== null && val !== undefined) {
      let nch = val.numberOfChannels
      if (nch < 1 || nch > 4 || nch === 3)
        throw DOMErr('ConvolverNode buffer must have 1, 2, or 4 channels', 'NotSupportedError')
      if (val.sampleRate !== this.context.sampleRate)
        throw DOMErr('ConvolverNode buffer sampleRate must match context sampleRate', 'NotSupportedError')
    }
    this.#buffer = val
    this.#overlapBuf = null
    if (val) {
      let nch = val.numberOfChannels
      this.#irChannels = []
      for (let c = 0; c < nch; c++) {
        let data = new Float32Array(val.getChannelData(c)) // acquire content — always copy
        if (this.#normalize) {
          let sum = 0
          for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
          let rms = Math.sqrt(sum / data.length)
          if (rms > 0) {
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
  set normalize(val) {
    val = !!val
    if (this.#normalize === val) return
    this.#normalize = val
    if (this.#buffer) this.buffer = this.#buffer // rebuild IR
  }

  constructor(context, options) {
    options = AudioNode._checkOpts(options)
    super(context, 1, 1, undefined, 'clamped-max', 'speakers')
    if (options.disableNormalization !== undefined) this.normalize = !options.disableNormalization
    if (options.buffer !== undefined) this.buffer = options.buffer
    this._outBuf = null
    this._outCh = 0
    this._applyOpts(options)
  }

  _validateChannelCount(val) {
    if (val > 2) throw DOMErr('channelCount cannot be greater than 2', 'NotSupportedError')
  }

  _validateChannelCountMode(val) {
    if (val === 'max') throw DOMErr("channelCountMode cannot be 'max'", 'NotSupportedError')
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
    // output channels: max(inCh, irCh)
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
