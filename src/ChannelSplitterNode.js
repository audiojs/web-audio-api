import AudioNode from './AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'

class ChannelSplitterNode extends AudioNode {

  constructor(context, { numberOfOutputs = 6 } = {}) {
    super(context, 1, numberOfOutputs, numberOfOutputs, 'explicit', 'discrete')
    this._outBufs = Array.from({ length: numberOfOutputs },
      () => new AudioBuffer(1, BLOCK_SIZE, context.sampleRate))
    this._lastTickTime = -1
  }

  // Called by AudioOutput._tick() per output port — returns mono buffer for that channel
  _tickOutput(outputIndex) {
    // pull input once per render quantum (all outputs share the same input)
    if (this._lastTickTime < this.context.currentTime) {
      this._lastTickTime = this.context.currentTime
      super._tick() // process scheduled events
      let inBuf = this._inputs[0]._tick()
      let nOut = this.numberOfOutputs
      for (let i = 0; i < nOut; i++) {
        let out = this._outBufs[i].getChannelData(0)
        if (i < inBuf.numberOfChannels) {
          out.set(inBuf.getChannelData(i))
        } else {
          out.fill(0)
        }
      }
    }
    return this._outBufs[outputIndex] || this._outBufs[0]
  }
}

export default ChannelSplitterNode
