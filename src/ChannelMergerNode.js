import AudioNode from './AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'

class ChannelMergerNode extends AudioNode {

  constructor(context, { numberOfInputs = 6 } = {}) {
    super(context, numberOfInputs, 1, 1, 'explicit', 'speakers')
    this._outBuf = new AudioBuffer(numberOfInputs, BLOCK_SIZE, context.sampleRate)
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
