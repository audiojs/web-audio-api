var BLOCK_SIZE = require('./constants').BLOCK_SIZE

class ChannelMixing {

  constructor(numberOfChannels, computedNumberOfChannels, channelInterpretation) {
    this.numberOfChannels = numberOfChannels
    this.computedNumberOfChannels = computedNumberOfChannels
    this.channelInterpretation = channelInterpretation
    if (this.numberOfChannels === this.computedNumberOfChannels) {
      this._process = this.identityProcess
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
  }

  identityProcess(inBuffer, outBuffer) {
    var inData, outData
    for (var ch = 0; ch < this.computedNumberOfChannels; ch++) {
      inData = inBuffer.getChannelData(ch)
      outData = outBuffer.getChannelData(ch)
      for (var i = 0; i < BLOCK_SIZE; i++)
        outData[i] += inData[i]
    }
  }

  discreteUpMix(inBuffer, outBuffer) {
    var chDataIn, chDataOut
    for (var ch = 0; ch < this.numberOfChannels; ch++) {
      chDataIn = inBuffer.getChannelData(ch)
      chDataOut = outBuffer.getChannelData(ch)
      for (var i = 0; i < BLOCK_SIZE; i++) chDataOut[i] += chDataIn[i]
    }
  }

  discreteDownMix(inBuffer, outBuffer) {
    var chDataIn, chDataOut
    for (var ch = 0; ch < this.computedNumberOfChannels; ch++) {
      chDataIn = inBuffer.getChannelData(ch)
      chDataOut = outBuffer.getChannelData(ch)
      for (var i = 0; i < BLOCK_SIZE; i++) {
        chDataOut[i] += chDataIn[i]
      }
    }
  }

  speakerMix12(inBuffer, outBuffer) {
    var inData = inBuffer.getChannelData(0)
    var dataOutL = outBuffer.getChannelData(0)
      , dataOutR = outBuffer.getChannelData(1)
    for (var i = 0; i < BLOCK_SIZE; i++) {
      dataOutL[i] += inData[i]
      dataOutR[i] += inData[i]
    }
  }

  speakerMix14(inBuffer, outBuffer) {
    var inData = inBuffer.getChannelData(0)
      , dataOutL = outBuffer.getChannelData(0)
      , dataOutR = outBuffer.getChannelData(1)
    for (var i = 0; i < BLOCK_SIZE; i++) {
      dataOutL[i] += inData[i]
      dataOutR[i] += inData[i]
    }
  }

  speakerMix16(inBuffer, outBuffer) {
    var inData = inBuffer.getChannelData(0)
      , dataOutC = outBuffer.getChannelData(2)
    for (var i = 0; i < BLOCK_SIZE; i++) {
      dataOutC[i] += inData[i]
    }
  }

  speakerMix24(inBuffer, outBuffer) {
    var dataL = inBuffer.getChannelData(0)
      , dataR = inBuffer.getChannelData(1)
      , dataOutL = outBuffer.getChannelData(0)
      , dataOutR = outBuffer.getChannelData(1)
    for (var i = 0; i < BLOCK_SIZE; i++) {
      dataOutL[i] += dataL[i]
      dataOutR[i] += dataR[i]
    }
  }

  speakerMix26(inBuffer, outBuffer) {
    var dataL = inBuffer.getChannelData(0)
      , dataR = inBuffer.getChannelData(1)
      , dataOutL = outBuffer.getChannelData(0)
      , dataOutR = outBuffer.getChannelData(1)
    for (var i = 0; i < BLOCK_SIZE; i++) {
      dataOutL[i] += dataL[i]
      dataOutR[i] += dataR[i]
    }
  }

  speakerMix46(inBuffer, outBuffer) {
    var dataL = inBuffer.getChannelData(0)
      , dataR = inBuffer.getChannelData(1)
      , dataSL = inBuffer.getChannelData(2)
      , dataSR = inBuffer.getChannelData(3)
      , dataOutL = outBuffer.getChannelData(0)
      , dataOutR = outBuffer.getChannelData(1)
      , dataOutSL = outBuffer.getChannelData(4)
      , dataOutSR = outBuffer.getChannelData(5)
    for (var i = 0; i < BLOCK_SIZE; i++) {
      dataOutL[i] += dataL[i]
      dataOutR[i] += dataR[i]
      dataOutSL[i] += dataSL[i]
      dataOutSR[i] += dataSR[i]
    }
  }

  speakerMix21(inBuffer, outBuffer) {
    var dataL = inBuffer.getChannelData(0)
      , dataR = inBuffer.getChannelData(1)
      , dataOut = outBuffer.getChannelData(0)
    for (var i = 0; i < BLOCK_SIZE; i++) {
      dataOut[i] += 0.5 * (dataL[i] + dataR[i])
    }
  }

  speakerMix41(inBuffer, outBuffer) {
    var dataL = inBuffer.getChannelData(0)
      , dataR = inBuffer.getChannelData(1)
      , dataSL = inBuffer.getChannelData(2)
      , dataSR = inBuffer.getChannelData(3)
      , dataOut = outBuffer.getChannelData(0)
    for (var i = 0; i < BLOCK_SIZE; i++) {
      dataOut[i] += 0.25 * (dataL[i] + dataR[i] + dataSL[i] + dataSR[i])
    }
  }

  speakerMix42(inBuffer, outBuffer) {
    var dataL = inBuffer.getChannelData(0)
      , dataR = inBuffer.getChannelData(1)
      , dataSL = inBuffer.getChannelData(2)
      , dataSR = inBuffer.getChannelData(3)
      , dataOutL = outBuffer.getChannelData(0)
      , dataOutR = outBuffer.getChannelData(1)

    for (var i = 0; i < BLOCK_SIZE; i++) {
      dataOutL[i] += 0.5 * (dataL[i] + dataSL[i])
      dataOutR[i] += 0.5 * (dataR[i] + dataSR[i])
    }
  }

  speakerMix61(inBuffer, outBuffer) {
    var dataL = inBuffer.getChannelData(0)
      , dataR = inBuffer.getChannelData(1)
      , dataC = inBuffer.getChannelData(2)
      , dataLFE = inBuffer.getChannelData(3)
      , dataSL = inBuffer.getChannelData(4)
      , dataSR = inBuffer.getChannelData(5)
      , dataOut = outBuffer.getChannelData(0)
    for (var i = 0; i < BLOCK_SIZE; i++) {
      dataOut[i] += 0.7071 * (dataL[i] + dataR[i]) + dataC[i] + 0.5 * (dataSL[i] + dataSR[i])
    }
  }

  speakerMix62(inBuffer, outBuffer) {
    var dataL = inBuffer.getChannelData(0)
      , dataR = inBuffer.getChannelData(1)
      , dataC = inBuffer.getChannelData(2)
      , dataLFE = inBuffer.getChannelData(3)
      , dataSL = inBuffer.getChannelData(4)
      , dataSR = inBuffer.getChannelData(5)
      , dataOutL = outBuffer.getChannelData(0)
      , dataOutR = outBuffer.getChannelData(1)

    for (var i = 0; i < BLOCK_SIZE; i++) {
      dataOutL[i] += dataL[i] + 0.7071 * (dataC[i] + dataSL[i])
      dataOutR[i] += dataR[i] + 0.7071 * (dataC[i] + dataSR[i])
    }
  }

  speakerMix64(inBuffer, outBuffer) {
    var dataL = inBuffer.getChannelData(0)
      , dataR = inBuffer.getChannelData(1)
      , dataC = inBuffer.getChannelData(2)
      , dataLFE = inBuffer.getChannelData(3)
      , dataSL = inBuffer.getChannelData(4)
      , dataSR = inBuffer.getChannelData(5)
      , dataOutL = outBuffer.getChannelData(0)
      , dataOutR = outBuffer.getChannelData(1)
      , dataOutSL = outBuffer.getChannelData(2)
      , dataOutSR = outBuffer.getChannelData(3)
    for (var i = 0; i < BLOCK_SIZE; i++) {
      dataOutL[i] += dataL[i] + 0.7071 * dataC[i]
      dataOutR[i] += dataR[i] + 0.7071 * dataC[i]
      dataOutSL[i] += dataSL[i]
      dataOutSR[i] += dataSR[i]
    }
  }

  process(inBuffer, outBuffer) {
    this._process(inBuffer, outBuffer)
    return outBuffer
  }
}

module.exports = ChannelMixing
