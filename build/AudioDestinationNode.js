var _ = require('underscore'),
  inherits = require('util').inherits,
  AudioNode = require('./AudioNode'),
  readOnlyAttr = require('./utils').readOnlyAttr


var AudioDestinationNode = (function(super$0){var DP$0 = Object.defineProperty;var MIXIN$0 = function(t,s){for(var p in s){if(s.hasOwnProperty(p)){DP$0(t,p,Object.getOwnPropertyDescriptor(s,p));}}return t};"use strict";MIXIN$0(AudioDestinationNode, super$0);
  function AudioDestinationNode(context) {
    super$0.call(this, context, 1, 0)
    readOnlyAttr(this, 'channelCountMode', 'explicit')
    readOnlyAttr(this, 'channelCount', 2)
    readOnlyAttr(this, 'channelInterpretation', 'speakers')
    readOnlyAttr(this, 'maxChannelCount', 2)
  }AudioDestinationNode.prototype = Object.create(super$0.prototype, {"constructor": {"value": AudioDestinationNode, "configurable": true, "writable": true} });DP$0(AudioDestinationNode, "prototype", {"configurable": false, "enumerable": false, "writable": false});

  // This only pulls the data from the nodes upstream
  AudioDestinationNode.prototype._tick = function() {
    return this._inputs[0]._tick()
  }

;return AudioDestinationNode;})(AudioNode);


module.exports = AudioDestinationNode
