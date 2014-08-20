var _ = require('underscore'),
  inherits = require('util').inherits,
  AudioNode = require('./AudioNode'),
  readOnlyAttr = require('./utils').readOnlyAttr


class AudioDestinationNode extends AudioNode {
  constructor(context) {
    super(context, 1, 0)
    readOnlyAttr(this, 'channelCountMode', 'explicit')
    readOnlyAttr(this, 'channelCount', 2)
    readOnlyAttr(this, 'channelInterpretation', 'speakers')
    readOnlyAttr(this, 'maxChannelCount', 2)
  }

  // This only pulls the data from the nodes upstream
  _tick() {
    return this._inputs[0]._tick()
  }

}


module.exports = AudioDestinationNode
