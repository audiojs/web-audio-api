import AudioScheduledSourceNode from './AudioScheduledSourceNode.js'
import AudioParam from './AudioParam.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'

class ConstantSourceNode extends AudioScheduledSourceNode {

  #offset
  get offset() { return this.#offset }

  constructor(context) {
    super(context, 0, 1, undefined, 'max', 'speakers')
    this.#offset = new AudioParam(this.context, 1, 'a')
    this._outBuf = new AudioBuffer(1, BLOCK_SIZE, context.sampleRate)
  }

  _dsp() {
    let values = this.#offset._tick()
    let out = this._outBuf.getChannelData(0)
    for (let i = 0; i < BLOCK_SIZE; i++) out[i] = values[i]
    return this._outBuf
  }
}

export default ConstantSourceNode
