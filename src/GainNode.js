import AudioNode from './AudioNode.js'
import AudioParam from './AudioParam.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'

class GainNode extends AudioNode {

  #gain

  get gain() { return this.#gain }

  constructor(context, options) {
    options = AudioNode._checkOpts(options)
    super(context, 1, 1, undefined, 'max', 'speakers')
    this.#gain = new AudioParam(this.context, options.gain ?? 1, 'a')
    this._outBuf = null
    this._outCh = 0
    this._applyOpts(options)
  }

  _tick() {
    super._tick()
    let inBuff = this._inputs[0]._tick()
    // Silence in → silence out regardless of gain; the param is a pure function
    // of the timeline, so deferring its tick loses nothing
    if (inBuff._silent) return inBuff
    let gainArray = this.#gain._tick()
    let ch = inBuff.numberOfChannels

    if (ch !== this._outCh) {
      this._outBuf = new AudioBuffer(ch, BLOCK_SIZE, this.context.sampleRate)
      this._outCh = ch
    }

    GainNode._dsp(inBuff, this._outBuf, gainArray, ch, BLOCK_SIZE)
    return this._outBuf
  }

  // Gain cannot create signal: silent input stays silent whatever the gain does,
  // so the sleep horizon is simply the input's earliest possible signal
  _silentUntil(blockEnd) {
    if (this._scheduled.length) return -Infinity
    let horizon = Infinity
    for (let output of this._inputs[0].connections)
      if ((horizon = Math.min(horizon, output._horizon(blockEnd))) <= blockEnd) return horizon
    return horizon
  }

  static _dsp(inBuf, outBuf, gain, channels, blockSize) {
    for (let c = 0; c < channels; c++) {
      let inp = inBuf.getChannelData(c)
      let out = outBuf.getChannelData(c)
      for (let i = 0; i < blockSize; i++)
        out[i] = inp[i] * gain[i]
    }
  }

}

export default GainNode
