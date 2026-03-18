import AudioNode from './AudioNode.js'
import { IndexSizeError, InvalidStateError } from './errors.js'

class AudioDestinationNode extends AudioNode {

  #maxChannelCount = 32
  get maxChannelCount() { return this.#maxChannelCount }

  constructor(context, channelCount = 2) {
    super(context, 1, 1, channelCount, 'explicit', 'speakers')
  }

  _validateChannelCount(val) {
    if (val > this.#maxChannelCount)
      throw new IndexSizeError('channelCount cannot exceed maxChannelCount (' + this.#maxChannelCount + ')')
  }

  _validateChannelCountMode(val) {
    if (val === 'max')
      throw new InvalidStateError('channelCountMode "max" is not allowed for AudioDestinationNode')
  }

  _tick() {
    return this._inputs[0]._tick()
  }

}

export default AudioDestinationNode
