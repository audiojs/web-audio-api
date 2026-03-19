import AudioNode from './AudioNode.js'
import { DOMErr } from './errors.js'


class AudioDestinationNode extends AudioNode {

  #maxChannelCount = 32
  get maxChannelCount() { return this.#maxChannelCount }

  constructor(context, channelCount = 2) {
    super(context, 1, 1, channelCount, 'explicit', 'speakers')
  }

  _validateChannelCount(val) {
    if (val > this.#maxChannelCount)
      throw DOMErr('channelCount cannot exceed maxChannelCount (' + this.#maxChannelCount + ')', 'IndexSizeError')
  }

  _validateChannelCountMode(val) {
    if (val === 'max')
      throw DOMErr('channelCountMode "max" is not allowed for AudioDestinationNode', 'InvalidStateError')
  }

  _tick() {
    return this._inputs[0]._tick()
  }

}

export default AudioDestinationNode
