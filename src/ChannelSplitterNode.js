import AudioNode from './AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'

class ChannelSplitterNode extends AudioNode {

  constructor(context, { numberOfOutputs = 6 } = {}) {
    super(context, 1, numberOfOutputs, numberOfOutputs, 'explicit', 'discrete')
    // pre-allocate mono output buffers per output port
    this._outBufs = Array.from({ length: numberOfOutputs },
      () => new AudioBuffer(1, BLOCK_SIZE, context.sampleRate))
  }

  _tick() {
    super._tick()
    let inBuf = this._inputs[0]._tick()
    let nOut = this.numberOfOutputs

    for (let i = 0; i < nOut; i++) {
      let out = this._outBufs[i].getChannelData(0)
      if (i < inBuf.numberOfChannels) {
        let src = inBuf.getChannelData(i)
        for (let j = 0; j < BLOCK_SIZE; j++) out[j] = src[j]
      } else {
        out.fill(0)
      }
    }

    // return full input for the node's output cache; individual outputs use _outBufs
    this._splitResult = inBuf
    return inBuf
  }

  // each output port pulls its mono channel buffer
  _getOutputBuffer(idx) {
    return this._outBufs[idx] || this._outBufs[0]
  }
}

export default ChannelSplitterNode
