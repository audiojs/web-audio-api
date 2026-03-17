import AudioNode from './AudioNode.js'
import AudioParam from './AudioParam.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'

class GainNode extends AudioNode {

  #gain

  get gain() { return this.#gain }

  constructor(context, options = {}) {
    super(context, 1, 1, options.channelCount, options.channelCountMode ?? 'max', options.channelInterpretation ?? 'speakers')
    this.#gain = new AudioParam(this.context, options.gain ?? 1, 'a')
    this._outBuf = null
    this._outCh = 0
  }

  _tick() {
    super._tick()
    let inBuff = this._inputs[0]._tick()
    let gainArray = this.#gain._tick()
    let ch = inBuff.numberOfChannels

    if (ch !== this._outCh) {
      this._outBuf = new AudioBuffer(ch, BLOCK_SIZE, this.context.sampleRate)
      this._outCh = ch
    }

    GainNode._dsp(inBuff, this._outBuf, gainArray, ch, BLOCK_SIZE)
    return this._outBuf
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
