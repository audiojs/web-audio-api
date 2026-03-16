import AudioNode from './AudioNode.js'

class AudioDestinationNode extends AudioNode {

  #maxChannelCount = 2
  get maxChannelCount() { return this.#maxChannelCount }

  constructor(context) {
    super(context, 1, 0, 2, 'explicit', 'speakers')
  }

  _tick() {
    return this._inputs[0]._tick()
  }

}

export default AudioDestinationNode
