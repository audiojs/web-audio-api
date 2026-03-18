import AudioScheduledSourceNode from './AudioScheduledSourceNode.js'
import AudioNode from './AudioNode.js'
import AudioParam from './AudioParam.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'

class ConstantSourceNode extends AudioScheduledSourceNode {

  #offset
  get offset() { return this.#offset }

  constructor(context, options) {
    options = AudioNode._checkOpts(options)
    super(context, 0, 1, undefined, 'max', 'speakers')
    this.#offset = new AudioParam(this.context, options.offset ?? 1, 'a')
    this._outBuf = new AudioBuffer(1, BLOCK_SIZE, context.sampleRate)
    this._applyOpts(options)
  }

  _dsp() {
    let values = this.#offset._tick()
    let count = this._activeBlockSize || BLOCK_SIZE
    let offset = this._blockStartOffset || 0
    let out = this._outBuf.getChannelData(0)
    for (let i = 0; i < count; i++) out[i] = values[offset + i]
    for (let i = count; i < BLOCK_SIZE; i++) out[i] = 0
    return this._outBuf
  }
}

export default ConstantSourceNode
