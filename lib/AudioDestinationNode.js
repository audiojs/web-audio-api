var _ = require('underscore')
  , inherits = require('util').inherits
  , AudioNode = require('./AudioNode')
  , readOnlyAttr = require('./utils').readOnlyAttr

var AudioDestinationNode = module.exports = function(context) {
  AudioNode.call(this, context, 1, 0)
  this.channelCountMode = 'explicit'
  readOnlyAttr(this, 'channelCount', 2)
  readOnlyAttr(this, 'channelInterpretation', 'speakers')
  readOnlyAttr(this, 'channelInterpretation', 'discrete')  
  readOnlyAttr(this, 'maxChannelCount', 2)
}
inherits(AudioDestinationNode, AudioNode)

_.extend(AudioDestinationNode.prototype, {

  // This only pulls the data from the nodes upstream
  _tick: function() { return this._inputs[0]._tick() }

})