import AudioNode from './AudioNode.js'
import {readOnlyAttr} from './utils.js'


class AudioDestinationNode extends AudioNode {

  constructor(context) {
    super(context, 1, 0, 2, 'explicit', 'speakers')

    readOnlyAttr(this, 'maxChannelCount', 2)
  }

  // This only pulls the data from the nodes upstream
  _tick() {
    return this._inputs[0]._tick()
  }

}


export default AudioDestinationNode
