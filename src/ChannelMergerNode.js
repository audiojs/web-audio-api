import AudioNode from './AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { IndexSizeError } from './errors.js'
import { BLOCK_SIZE } from './constants.js'

class ChannelMergerNode extends AudioNode {

  constructor(context, options) {
    options = AudioNode._checkOpts(options)
    let numberOfInputs = options.numberOfInputs ?? 6
    if (numberOfInputs < 1 || numberOfInputs > 32)
      throw new IndexSizeError('numberOfInputs must be between 1 and 32')
    super(context, numberOfInputs, 1, 1, 'explicit', 'speakers')
    this._outBuf = new AudioBuffer(numberOfInputs, BLOCK_SIZE, context.sampleRate)
    this._applyOpts(options)
  }

  _validateChannelCount(val) {
    if (val !== 1) throw new (globalThis.DOMException || Error)('ChannelMergerNode channelCount must be 1', 'InvalidStateError')
  }

  _validateChannelCountMode(val) {
    if (val !== 'explicit') throw new (globalThis.DOMException || Error)('ChannelMergerNode channelCountMode must be explicit', 'InvalidStateError')
  }

  _tick() {
    super._tick()
    let nInputs = this.numberOfInputs
    for (let i = 0; i < nInputs; i++) {
      let inBuf = this._inputs[i]._tick()
      let src = inBuf.getChannelData(0)
      let dst = this._outBuf.getChannelData(i)
      for (let j = 0; j < BLOCK_SIZE; j++) dst[j] = src[j]
    }
    return this._outBuf
  }
}

export default ChannelMergerNode
