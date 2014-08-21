var constants = require('./constants'),
  AudioNode = require('./AudioNode'),
  AudioParam = require('./AudioParam'),
  AudioBuffer = require('audiobuffer'),
  readOnlyAttr = require('./utils').readOnlyAttr;


var AudioBufferSourceNode = (function(super$0){var DP$0 = Object.defineProperty;var MIXIN$0 = function(t,s){for(var p in s){if(s.hasOwnProperty(p)){DP$0(t,p,Object.getOwnPropertyDescriptor(s,p));}}return t};"use strict";MIXIN$0(AudioBufferSourceNode, super$0);

  function AudioBufferSourceNode(context) {
    super$0.call(this, context, 0, 1);
    this.channelCountMode = 'max';
    this.channelInterpretation = 'speakers';

    this.buffer = null;
    this.loop = false;
    this.loopStart = 0;
    this.loopEnd = 0;

    readOnlyAttr(this, 'playbackRate', new AudioParam(this.context, 1, 'a'));

    this._dsp = this._dspZeros;
  }AudioBufferSourceNode.prototype = Object.create(super$0.prototype, {"constructor": {"value": AudioBufferSourceNode, "configurable": true, "writable": true} });DP$0(AudioBufferSourceNode, "prototype", {"configurable": false, "enumerable": false, "writable": false});

  AudioBufferSourceNode.prototype.start = function(when, offset, duration) {var this$0 = this;
    this._schedule('start', when, function()  {
      if (!this$0.buffer) throw new Error('invalid buffer');

      // Subsequent calls to `start` have no effect
      this$0.start = function() {};

      // keeps track of the current position in the buffer
      var blockSize = constants.BLOCK_SIZE,
        sampleRate = this$0.context.sampleRate,
        cursor, cursorEnd, cursorNext, missingFrames, outBuffer;

      var reinitPlayback = function()  {
        cursor = (offset ? offset : this$0.loopStart) * sampleRate;
        if (duration) cursorEnd = cursor + duration * sampleRate;
        else if (this$0.loopEnd) cursorEnd = this$0.loopEnd * sampleRate;
        else cursorEnd = this$0.buffer.length;
        cursorNext = cursor;
      };
      reinitPlayback();

      this$0._dsp = function() {
        cursorNext = cursor + blockSize;
        // If there's enough data left to be read in the buffer, just read it,
        // otherwise we need to handle things a bit differently
        if (cursorNext < cursorEnd) {
          outBuffer = this.buffer.slice(cursor, cursorNext);
          cursor = cursorNext;
          return outBuffer;
        } else {
          outBuffer = new AudioBuffer(this.buffer.numberOfChannels, blockSize, sampleRate);
          outBuffer.set(this.buffer.slice(cursor, cursorNext));
          // If looping, we must reinitialize our cursor variables.
          // If not looping, we free the node
          if (this.loop) {
            missingFrames = cursorNext - cursorEnd;
            reinitPlayback();
            cursorNext = cursor + missingFrames;
            outBuffer.set(this.buffer.slice(cursor, cursorNext), outBuffer.length - missingFrames);
          } else {
            if (this.onended) {
              this._schedule('onended', this.context.currentTime + (cursorNext - cursorEnd) / sampleRate, this.onended);
            }
            this._schedule('kill', this.context.currentTime + (cursorNext - cursorEnd) / sampleRate, this._kill.bind(this));
          }
          cursor = cursorNext;
          return outBuffer;
        }
      };

    });
  }

  AudioBufferSourceNode.prototype.stop = function(when) {var this$0 = this;
    this._schedule('stop', when, function()  {
      this$0._dsp = this$0._dspZeros;
    });
  }

  AudioBufferSourceNode.prototype.onended = function() {}

  AudioBufferSourceNode.prototype._tick = function() {
    super$0.prototype._tick.call(this, arguments);
    return this._dsp();
  }

  AudioBufferSourceNode.prototype._dsp = function() {}

  AudioBufferSourceNode.prototype._dspZeros = function() {
    return new AudioBuffer(1, constants.BLOCK_SIZE, this.context.sampleRate);
  }

;return AudioBufferSourceNode;})(AudioNode);

module.exports = AudioBufferSourceNode;
