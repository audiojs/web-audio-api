import AudioNode from './AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'
import { DOMErr } from './errors.js'

class ChannelSplitterNode extends AudioNode {

  constructor(context, options = {}) {
    let numberOfOutputs = options?.numberOfOutputs ?? 6
    if (numberOfOutputs < 1 || numberOfOutputs > 32)
      throw DOMErr(`numberOfOutputs (${numberOfOutputs}) is outside [1, 32]`, 'IndexSizeError')

    // validate locked properties from options
    let channelCount = options?.channelCount ?? numberOfOutputs
    if (channelCount !== numberOfOutputs)
      throw DOMErr(`channelCount (${channelCount}) must equal numberOfOutputs (${numberOfOutputs})`, 'InvalidStateError')
    let channelCountMode = options?.channelCountMode ?? 'explicit'
    if (channelCountMode !== 'explicit')
      throw DOMErr(`channelCountMode must be 'explicit'`, 'InvalidStateError')
    let channelInterpretation = options?.channelInterpretation ?? 'discrete'
    if (channelInterpretation !== 'discrete')
      throw DOMErr(`channelInterpretation must be 'discrete'`, 'InvalidStateError')

    super(context, 1, numberOfOutputs, numberOfOutputs, 'explicit', 'discrete')
    this._outBufs = Array.from({ length: numberOfOutputs },
      () => new AudioBuffer(1, BLOCK_SIZE, context.sampleRate))
    this._lastTickTime = -1
  }

  _validateChannelCount(val) {
    if (val !== this.numberOfOutputs)
      throw DOMErr(`channelCount must equal numberOfOutputs (${this.numberOfOutputs})`, 'InvalidStateError')
  }

  _validateChannelCountMode(val) {
    if (val !== 'explicit') throw DOMErr(`channelCountMode must be 'explicit'`, 'InvalidStateError')
  }

  _validateChannelInterpretation(val) {
    if (val !== 'discrete') throw DOMErr(`channelInterpretation must be 'discrete'`, 'InvalidStateError')
  }

  _tickOutput(outputIndex) {
    if (this._lastTickTime < this.context.currentTime) {
      this._lastTickTime = this.context.currentTime
      super._tick()
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
