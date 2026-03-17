import AudioNode from './AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { IndexSizeError, InvalidStateError } from './errors.js'
import { BLOCK_SIZE } from './constants.js'

class ChannelSplitterNode extends AudioNode {

  constructor(context, options = {}) {
    let numberOfOutputs = options?.numberOfOutputs ?? 6
    if (numberOfOutputs < 1 || numberOfOutputs > 32)
      throw new IndexSizeError(`numberOfOutputs (${numberOfOutputs}) is outside [1, 32]`)

    // validate locked properties from options
    let channelCount = options?.channelCount ?? numberOfOutputs
    if (channelCount !== numberOfOutputs)
      throw new InvalidStateError(`channelCount (${channelCount}) must equal numberOfOutputs (${numberOfOutputs})`)
    let channelCountMode = options?.channelCountMode ?? 'explicit'
    if (channelCountMode !== 'explicit')
      throw new InvalidStateError(`channelCountMode must be 'explicit'`)
    let channelInterpretation = options?.channelInterpretation ?? 'discrete'
    if (channelInterpretation !== 'discrete')
      throw new InvalidStateError(`channelInterpretation must be 'discrete'`)

    super(context, 1, numberOfOutputs, numberOfOutputs, 'explicit', 'discrete')
    this._outBufs = Array.from({ length: numberOfOutputs },
      () => new AudioBuffer(1, BLOCK_SIZE, context.sampleRate))
    this._lastTickTime = -1
  }

  _validateChannelCount(val) {
    if (val !== this.numberOfOutputs)
      throw new InvalidStateError(`channelCount must equal numberOfOutputs (${this.numberOfOutputs})`)
  }

  _validateChannelCountMode(val) {
    if (val !== 'explicit') throw new InvalidStateError(`channelCountMode must be 'explicit'`)
  }

  _validateChannelInterpretation(val) {
    if (val !== 'discrete') throw new InvalidStateError(`channelInterpretation must be 'discrete'`)
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
