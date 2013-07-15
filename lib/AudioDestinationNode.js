var _ = require('underscore')
  , inherits = require('util').inherits
  , AudioNode = require('AudioNode')
  , readOnlyAttr = require('./utils').readOnlyAttr

AudioDestinationNode = function(context) {
  AudioNode.call(this, context, 1, 0)
  readOnlyAttr(this, 'numberOfInputs', 1)
  readOnlyAttr(this, 'numberOfOutputs', 0)
  readOnlyAttr(this, 'channelCount', 2)
  readOnlyAttr(this, 'channelCountMode', 'explicit')
  readOnlyAttr(this, 'channelInterpretation', 'speakers')
  readOnlyAttr(this, 'maxChannelCount', 2)
}
inherits(AudioDestinationNode, AudioNode)

_.extend(AudioDestinationNode.prototype, {

  // This only pulls the data from the nodes upstream
  pullAudio: function(done) { this._inputs[0].pullAudio(done) }

})