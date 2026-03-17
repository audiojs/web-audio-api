import AudioNode from './AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { IndexSizeError } from './errors.js'
import { BLOCK_SIZE } from './constants.js'

class ChannelMergerNode extends AudioNode {

  constructor(context, { numberOfInputs = 6 } = {}) {
    if (numberOfInputs < 1 || numberOfInputs > 32)
      throw new IndexSizeError('numberOfInputs must be between 1 and 32')
    super(context, numberOfInputs, 1, 1, 'explicit', 'speakers')
    this._outBuf = new AudioBuffer(numberOfInputs, BLOCK_SIZE, context.sampleRate)
  }

  // channelCount is locked to 1
  _validateChannelCount(val) {
    if (val !== 1) throw new Error('ChannelMergerNode channelCount must be 1')
  }

  // channelCountMode is locked to explicit
  _validateChannelCountMode(val) {
    if (val !== 'explicit') throw new Error('ChannelMergerNode channelCountMode must be explicit')
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
