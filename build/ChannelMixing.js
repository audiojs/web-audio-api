var BLOCK_SIZE = require('./constants').BLOCK_SIZE;

var ChannelMixing = (function(){var DP$0 = Object.defineProperty;"use strict";

  function ChannelMixing(numberOfChannels, computedNumberOfChannels, channelInterpretation) {
    this.numberOfChannels = numberOfChannels;
    this.computedNumberOfChannels = computedNumberOfChannels;
    this.channelInterpretation = channelInterpretation;
    if (this.numberOfChannels === this.computedNumberOfChannels) {
      this._process = this.identityProcess;
    } else {
      if (this.channelInterpretation === 'speakers') {
        this._process = this['speakerMix' + this.numberOfChannels + this.computedNumberOfChannels]
        if (!this._process) {
          // well, this is ugly.
          if (this.numberOfChannels < this.computedNumberOfChannels) {
            this._process = this.discreteUpMix
          } else {
            this._process = this.discreteDownMix
          }
        }
      } else {
        if (this.numberOfChannels < this.computedNumberOfChannels) {
          this._process = this.discreteUpMix
        } else {
          this._process = this.discreteDownMix
        }
      }
    }
  }DP$0(ChannelMixing, "prototype", {"configurable": false, "enumerable": false, "writable": false});

  ChannelMixing.prototype.identityProcess = function(inBuffer, outBuffer) {
    var inData, outData;
    for (var ch = 0; ch < this.computedNumberOfChannels; ch++) {
      inData = inBuffer.getChannelData(ch)
      outData = outBuffer.getChannelData(ch)
      for (var i = 0; i < BLOCK_SIZE; i++)
        outData[i] += inData[i]
    }
  }

  ChannelMixing.prototype.discreteUpMix = function(inBuffer, outBuffer) {
    var chDataIn, chDataOut;
    for (var ch = 0; ch < this.numberOfChannels; ch++) {
      chDataIn = inBuffer.getChannelData(ch)
      chDataOut = outBuffer.getChannelData(ch)
      for (var i = 0; i < BLOCK_SIZE; i++) chDataOut[i] += chDataIn[i]
    }
  }

  ChannelMixing.prototype.discreteDownMix = function(inBuffer, outBuffer) {
    var chDataIn, chDataOut;
    for (var ch = 0; ch < this.computedNumberOfChannels; ch++) {
      chDataIn = inBuffer.getChannelData(ch)
      chDataOut = outBuffer.getChannelData(ch)
      for (var i = 0; i < BLOCK_SIZE; i++) {
        chDataOut[i] += chDataIn[i]
      }
    }
  }

  ChannelMixing.prototype.speakerMix12 = function(inBuffer, outBuffer) {
    var inData = inBuffer.getChannelData(0);
    var dataOutL = outBuffer.getChannelData(0),
      dataOutR = outBuffer.getChannelData(1);
    for (var i = 0; i < BLOCK_SIZE; i++) {
      dataOutL[i] += inData[i]
      dataOutR[i] += inData[i]
    }
  }

  ChannelMixing.prototype.speakerMix14 = function(inBuffer, outBuffer) {
    var inData = inBuffer.getChannelData(0);
    var dataOutL = outBuffer.getChannelData(0),
      dataOutR = outBuffer.getChannelData(1)
    for (var i = 0; i < BLOCK_SIZE; i++) {
      dataOutL[i] += inData[i]
      dataOutR[i] += inData[i]
    }
  }

  ChannelMixing.prototype.speakerMix16 = function(inBuffer, outBuffer) {
    var inData = inBuffer.getChannelData(0);
    var dataOutC = outBuffer.getChannelData(2);
    for (var i = 0; i < BLOCK_SIZE; i++) {
      dataOutC[i] += inData[i]
    }
  }

  ChannelMixing.prototype.speakerMix24 = function(inBuffer, outBuffer) {
    var dataL = inBuffer.getChannelData(0),
      dataR = inBuffer.getChannelData(1);
    var dataOutL = outBuffer.getChannelData(0),
      dataOutR = outBuffer.getChannelData(1);
    for (var i = 0; i < BLOCK_SIZE; i++) {
      dataOutL[i] += dataL[i]
      dataOutR[i] += dataR[i]
    }
  }

  ChannelMixing.prototype.speakerMix26 = function(inBuffer, outBuffer) {
    var dataL = inBuffer.getChannelData(0),
      dataR = inBuffer.getChannelData(1);
    var dataOutL = outBuffer.getChannelData(0),
      dataOutR = outBuffer.getChannelData(1);
    for (var i = 0; i < BLOCK_SIZE; i++) {
      dataOutL[i] += dataL[i]
      dataOutR[i] += dataR[i]
    }
  }

  ChannelMixing.prototype.speakerMix46 = function(inBuffer, outBuffer) {
    var dataL = inBuffer.getChannelData(0),
      dataR = inBuffer.getChannelData(1),
      dataSL = inBuffer.getChannelData(2),
      dataSR = inBuffer.getChannelData(3);
    var dataOutL = outBuffer.getChannelData(0),
      dataOutR = outBuffer.getChannelData(1),
      dataOutSL = outBuffer.getChannelData(4),
      dataOutSR = outBuffer.getChannelData(5);
    for (var i = 0; i < BLOCK_SIZE; i++) {
      dataOutL[i] += dataL[i]
      dataOutR[i] += dataR[i]
      dataOutSL[i] += dataSL[i]
      dataOutSR[i] += dataSR[i]
    }
  }

  ChannelMixing.prototype.speakerMix21 = function(inBuffer, outBuffer) {
    var dataL = inBuffer.getChannelData(0),
      dataR = inBuffer.getChannelData(1);
    var dataOut = outBuffer.getChannelData(0);

    for (var i = 0; i < BLOCK_SIZE; i++) {
      dataOut[i] += 0.5 * (dataL[i] + dataR[i])
    }
  }

  ChannelMixing.prototype.speakerMix41 = function(inBuffer, outBuffer) {
    var dataL = inBuffer.getChannelData(0),
      dataR = inBuffer.getChannelData(1),
      dataSL = inBuffer.getChannelData(2),
      dataSR = inBuffer.getChannelData(3);
    var dataOut = outBuffer.getChannelData(0);
    for (var i = 0; i < BLOCK_SIZE; i++) {
      dataOut[i] += 0.25 * (dataL[i] + dataR[i] + dataSL[i] + dataSR[i])
    }
  }

  ChannelMixing.prototype.speakerMix42 = function(inBuffer, outBuffer) {
    var dataL = inBuffer.getChannelData(0),
      dataR = inBuffer.getChannelData(1),
      dataSL = inBuffer.getChannelData(2),
      dataSR = inBuffer.getChannelData(3);
    var dataOutL = outBuffer.getChannelData(0),
      dataOutR = outBuffer.getChannelData(1);

    for (var i = 0; i < BLOCK_SIZE; i++) {
      dataOutL[i] += 0.5 * (dataL[i] + dataSL[i])
      dataOutR[i] += 0.5 * (dataR[i] + dataSR[i])
    }
  }

  ChannelMixing.prototype.speakerMix61 = function(inBuffer, outBuffer) {
    var dataL = inBuffer.getChannelData(0),
      dataR = inBuffer.getChannelData(1),
      dataC = inBuffer.getChannelData(2),
      dataLFE = inBuffer.getChannelData(3),
      dataSL = inBuffer.getChannelData(4),
      dataSR = inBuffer.getChannelData(5);
    var dataOut = outBuffer.getChannelData(0);
    var dataOut = outBuffer.getChannelData(0)
    for (var i = 0; i < BLOCK_SIZE; i++) {
      dataOut[i] += 0.7071 * (dataL[i] + dataR[i]) + dataC[i] + 0.5 * (dataSL[i] + dataSR[i])
    }
  }

  ChannelMixing.prototype.speakerMix62 = function(inBuffer, outBuffer) {
    var dataL = inBuffer.getChannelData(0),
      dataR = inBuffer.getChannelData(1),
      dataC = inBuffer.getChannelData(2),
      dataLFE = inBuffer.getChannelData(3),
      dataSL = inBuffer.getChannelData(4),
      dataSR = inBuffer.getChannelData(5);
    var dataOutL = outBuffer.getChannelData(0),
      dataOutR = outBuffer.getChannelData(1);

    for (var i = 0; i < BLOCK_SIZE; i++) {
      dataOutL[i] += dataL[i] + 0.7071 * (dataC[i] + dataSL[i])
      dataOutR[i] += dataR[i] + 0.7071 * (dataC[i] + dataSR[i])
    }
  }

  ChannelMixing.prototype.speakerMix64 = function(inBuffer, outBuffer) {
    var dataL = inBuffer.getChannelData(0),
      dataR = inBuffer.getChannelData(1),
      dataC = inBuffer.getChannelData(2),
      dataLFE = inBuffer.getChannelData(3),
      dataSL = inBuffer.getChannelData(4),
      dataSR = inBuffer.getChannelData(5);
    var dataOutL = outBuffer.getChannelData(0),
      dataOutR = outBuffer.getChannelData(1),
      dataOutSL = outBuffer.getChannelData(2),
      dataOutSR = outBuffer.getChannelData(3);

    for (var i = 0; i < BLOCK_SIZE; i++) {
      dataOutL[i] += dataL[i] + 0.7071 * dataC[i]
      dataOutR[i] += dataR[i] + 0.7071 * dataC[i]
      dataOutSL[i] += dataSL[i]
      dataOutSR[i] += dataSR[i]
    }
  }

  ChannelMixing.prototype.process = function(inBuffer, outBuffer) {
    this._process(inBuffer, outBuffer);
    return outBuffer
  }
;return ChannelMixing;})();

module.exports = ChannelMixing
