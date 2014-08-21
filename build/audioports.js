var DP$0 = Object.defineProperty;var MIXIN$0 = function(t,s){for(var p in s){if(s.hasOwnProperty(p)){DP$0(t,p,Object.getOwnPropertyDescriptor(s,p));}}return t};var _ = require('underscore'),
  async = require('async'),
  inherits = require('util').inherits,
  events = require('events'),
  utils = require('./utils'),
  AudioBuffer = require('audiobuffer'),
  BLOCK_SIZE = require('./constants').BLOCK_SIZE,
  ChannelMixing = require('./ChannelMixing')


var AudioPort = (function(super$0){"use strict";MIXIN$0(AudioPort, super$0);

  function AudioPort(context, node, id) {
    super$0.call(this)
    this.connections = []
    this.node = node
    this.id = id
    this.context = context
  }AudioPort.prototype = Object.create(super$0.prototype, {"constructor": {"value": AudioPort, "configurable": true, "writable": true} });DP$0(AudioPort, "prototype", {"configurable": false, "enumerable": false, "writable": false});

  // Generic function for connecting the calling AudioPort
  // with `otherPort`. Returns true if a connection was indeed established
  AudioPort.prototype.connect = function(otherPort) {
    if (this.connections.indexOf(otherPort) !== -1) return false
    this.connections.push(otherPort)
    otherPort.connect(this)
    this.emit('connection', otherPort)
    return true
  }

  // Generic function for disconnecting the calling AudioPort
  // from `otherPort`. Returns true if a disconnection was indeed made
  AudioPort.prototype.disconnect = function(otherPort) {
    var connInd = this.connections.indexOf(otherPort)
    if (connInd === -1) return false
    this.connections.splice(connInd, 1)
    otherPort.disconnect(this)
    this.emit('disconnection', otherPort)
    return true
  }

  // Called when a node is killed. Removes connections, and event listeners.
  AudioPort.prototype._kill = function() {var this$0 = this;
    this.connections.slice(0).forEach(function(port)  {
      this$0.disconnect(port)
    })
    this.removeAllListeners()
  }

;return AudioPort;})(events.EventEmitter);

var AudioInput = (function(super$0){"use strict";MIXIN$0(AudioInput, super$0);

  function AudioInput(context, node, id) {var this$0 = this;
    super$0.call(this, context, node, id);

    // `computedNumberOfChannels` is scheduled to be recalculated everytime a connection
    // or disconnection happens.
    this.computedNumberOfChannels = null;
    this.on('connected', function()  {
      this$0.computedNumberOfChannels = null;
    })
    this.on('disconnected', function()  {
      this$0.computedNumberOfChannels = null;
    })

    // Just for code clarity
    Object.defineProperty(this, 'sources', {
      get: function() {
        return this.connections;
      }
    });
  }AudioInput.prototype = Object.create(super$0.prototype, {"constructor": {"value": AudioInput, "configurable": true, "writable": true} });DP$0(AudioInput, "prototype", {"configurable": false, "enumerable": false, "writable": false});

  AudioInput.prototype.connect = function(source) {var this$0 = this;
    // When the number of channels of the source changes, we trigger
    // computation of `computedNumberOfChannels`
    source.on('_numberOfChannels', function()  {
      this$0.computedNumberOfChannels = null
    })
    //AudioPort.prototype.connect.call(this, source)
    super$0.prototype.connect.call(this, source)
  }

  AudioInput.prototype.disconnect = function(source) {
    source.removeAllListeners('_numberOfChannels')
    //AudioPort.prototype.disconnect.call(this, source)
    super$0.prototype.disconnect.call(this, source)
  }

  AudioInput.prototype._tick = function() {var this$0 = this;
    var i, ch, inNumChannels, inBuffers = this.sources.map(function(source) {
      return source._tick();
    });

    if (this.computedNumberOfChannels === null) {
      var maxChannelsUpstream;
      if (this.sources.length) {
        maxChannelsUpstream = _.chain(inBuffers).pluck('numberOfChannels').max().value();
      } else maxChannelsUpstream = 0;
      this._computeNumberOfChannels(maxChannelsUpstream);
    }
    var outBuffer = new AudioBuffer(this.computedNumberOfChannels, BLOCK_SIZE, this.context.sampleRate);

    inBuffers.forEach(function(inBuffer)  {
      var ch = new ChannelMixing(inBuffer.numberOfChannels, this$0.computedNumberOfChannels, this$0.node.channelInterpretation);
      ch.process(inBuffer, outBuffer);
    });
    return outBuffer;
  }

  AudioInput.prototype._computeNumberOfChannels = function(maxChannelsUpstream) {
    var countMode = this.node.channelCountMode,
      channelCount = this.node.channelCount
    maxChannelsUpstream = maxChannelsUpstream || 1

    if (countMode === 'max') {
      this.computedNumberOfChannels = maxChannelsUpstream
    } else if (countMode === 'clamped-max') {
      this.computedNumberOfChannels = Math.min(maxChannelsUpstream, channelCount)
    } else if (countMode === 'explicit')
      this.computedNumberOfChannels = channelCount
      // this shouldn't happen
    else throw new Error('invalid channelCountMode')
  }

;return AudioInput;})(AudioPort);

var AudioOutput = (function(super$0){"use strict";MIXIN$0(AudioOutput, super$0);

  function AudioOutput(context, node, id) {
    super$0.call(this, context, node, id)

    // This caches the block fetched from the node.
    this._cachedBlock = {
      time: -1,
      buffer: null
    }

    // This catches the number of channels of the audio going through this output
    this._numberOfChannels = null

    // Just for code clarity
    Object.defineProperty(this, 'sinks', {
      get: function() {
        return this.connections
      }
    })
  }AudioOutput.prototype = Object.create(super$0.prototype, {"constructor": {"value": AudioOutput, "configurable": true, "writable": true} });DP$0(AudioOutput, "prototype", {"configurable": false, "enumerable": false, "writable": false});

  // Pulls the audio from the node only once, and copies it so that several
  // nodes downstream can pull the same block.
  AudioOutput.prototype._tick = function() {
    if (this._cachedBlock.time < this.context.currentTime) {
      var outBuffer = this.node._tick()
      if (this._numberOfChannels !== outBuffer.numberOfChannels) {
        this._numberOfChannels = outBuffer.numberOfChannels
        this.emit('_numberOfChannels')
      }
      this._cachedBlock = {
        time: this.context.currentTime,
        buffer: outBuffer
      }
      return outBuffer
    } else return this._cachedBlock.buffer
  }

;return AudioOutput;})(AudioPort);

module.exports = {
  AudioOutput: AudioOutput,
  AudioInput: AudioInput
}
