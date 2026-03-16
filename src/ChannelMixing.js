import { BLOCK_SIZE } from './constants.js'

// speaker mix lookup: key = inCh * 10 + outCh
const SPEAKER_MIX = {}

class ChannelMixing {

  constructor(numberOfChannels, computedNumberOfChannels, channelInterpretation) {
    this.numberOfChannels = numberOfChannels
    this.computedNumberOfChannels = computedNumberOfChannels

    if (numberOfChannels === computedNumberOfChannels) {
      this._process = this.identityProcess
    } else if (channelInterpretation === 'speakers') {
      let key = numberOfChannels * 10 + computedNumberOfChannels
      this._process = SPEAKER_MIX[key]
        || (numberOfChannels < computedNumberOfChannels ? this.discreteUpMix : this.discreteDownMix)
    } else {
      this._process = numberOfChannels < computedNumberOfChannels ? this.discreteUpMix : this.discreteDownMix
    }
  }

  identityProcess(inBuffer, outBuffer) {
    for (let ch = 0; ch < this.computedNumberOfChannels; ch++) {
      let inp = inBuffer.getChannelData(ch), out = outBuffer.getChannelData(ch)
      for (let i = 0; i < BLOCK_SIZE; i++) out[i] += inp[i]
    }
  }

  discreteUpMix(inBuffer, outBuffer) {
    for (let ch = 0; ch < this.numberOfChannels; ch++) {
      let inp = inBuffer.getChannelData(ch), out = outBuffer.getChannelData(ch)
      for (let i = 0; i < BLOCK_SIZE; i++) out[i] += inp[i]
    }
  }

  discreteDownMix(inBuffer, outBuffer) {
    for (let ch = 0; ch < this.computedNumberOfChannels; ch++) {
      let inp = inBuffer.getChannelData(ch), out = outBuffer.getChannelData(ch)
      for (let i = 0; i < BLOCK_SIZE; i++) out[i] += inp[i]
    }
  }

  process(inBuffer, outBuffer) {
    this._process(inBuffer, outBuffer)
    return outBuffer
  }
}

// --- speaker mix strategies ---
// Each is a standalone function bound as _process

SPEAKER_MIX[12] = function(inBuffer, outBuffer) { // mono → stereo
  let inp = inBuffer.getChannelData(0)
  let outL = outBuffer.getChannelData(0), outR = outBuffer.getChannelData(1)
  for (let i = 0; i < BLOCK_SIZE; i++) { outL[i] += inp[i]; outR[i] += inp[i] }
}

SPEAKER_MIX[14] = function(inBuffer, outBuffer) { // mono → quad
  let inp = inBuffer.getChannelData(0)
  let outL = outBuffer.getChannelData(0), outR = outBuffer.getChannelData(1)
  for (let i = 0; i < BLOCK_SIZE; i++) { outL[i] += inp[i]; outR[i] += inp[i] }
}

SPEAKER_MIX[16] = function(inBuffer, outBuffer) { // mono → 5.1
  let inp = inBuffer.getChannelData(0), outC = outBuffer.getChannelData(2)
  for (let i = 0; i < BLOCK_SIZE; i++) outC[i] += inp[i]
}

SPEAKER_MIX[24] = function(inBuffer, outBuffer) { // stereo → quad
  let L = inBuffer.getChannelData(0), R = inBuffer.getChannelData(1)
  let oL = outBuffer.getChannelData(0), oR = outBuffer.getChannelData(1)
  for (let i = 0; i < BLOCK_SIZE; i++) { oL[i] += L[i]; oR[i] += R[i] }
}

SPEAKER_MIX[26] = function(inBuffer, outBuffer) { // stereo → 5.1
  let L = inBuffer.getChannelData(0), R = inBuffer.getChannelData(1)
  let oL = outBuffer.getChannelData(0), oR = outBuffer.getChannelData(1)
  for (let i = 0; i < BLOCK_SIZE; i++) { oL[i] += L[i]; oR[i] += R[i] }
}

SPEAKER_MIX[46] = function(inBuffer, outBuffer) { // quad → 5.1
  let L = inBuffer.getChannelData(0), R = inBuffer.getChannelData(1)
  let SL = inBuffer.getChannelData(2), SR = inBuffer.getChannelData(3)
  let oL = outBuffer.getChannelData(0), oR = outBuffer.getChannelData(1)
  let oSL = outBuffer.getChannelData(4), oSR = outBuffer.getChannelData(5)
  for (let i = 0; i < BLOCK_SIZE; i++) { oL[i] += L[i]; oR[i] += R[i]; oSL[i] += SL[i]; oSR[i] += SR[i] }
}

SPEAKER_MIX[21] = function(inBuffer, outBuffer) { // stereo → mono
  let L = inBuffer.getChannelData(0), R = inBuffer.getChannelData(1)
  let out = outBuffer.getChannelData(0)
  for (let i = 0; i < BLOCK_SIZE; i++) out[i] += 0.5 * (L[i] + R[i])
}

SPEAKER_MIX[41] = function(inBuffer, outBuffer) { // quad → mono
  let L = inBuffer.getChannelData(0), R = inBuffer.getChannelData(1)
  let SL = inBuffer.getChannelData(2), SR = inBuffer.getChannelData(3)
  let out = outBuffer.getChannelData(0)
  for (let i = 0; i < BLOCK_SIZE; i++) out[i] += 0.25 * (L[i] + R[i] + SL[i] + SR[i])
}

SPEAKER_MIX[42] = function(inBuffer, outBuffer) { // quad → stereo
  let L = inBuffer.getChannelData(0), R = inBuffer.getChannelData(1)
  let SL = inBuffer.getChannelData(2), SR = inBuffer.getChannelData(3)
  let oL = outBuffer.getChannelData(0), oR = outBuffer.getChannelData(1)
  for (let i = 0; i < BLOCK_SIZE; i++) { oL[i] += 0.5 * (L[i] + SL[i]); oR[i] += 0.5 * (R[i] + SR[i]) }
}

SPEAKER_MIX[61] = function(inBuffer, outBuffer) { // 5.1 → mono
  let L = inBuffer.getChannelData(0), R = inBuffer.getChannelData(1)
  let C = inBuffer.getChannelData(2), SL = inBuffer.getChannelData(4), SR = inBuffer.getChannelData(5)
  let out = outBuffer.getChannelData(0)
  for (let i = 0; i < BLOCK_SIZE; i++) out[i] += 0.7071 * (L[i] + R[i]) + C[i] + 0.5 * (SL[i] + SR[i])
}

SPEAKER_MIX[62] = function(inBuffer, outBuffer) { // 5.1 → stereo
  let L = inBuffer.getChannelData(0), R = inBuffer.getChannelData(1)
  let C = inBuffer.getChannelData(2), SL = inBuffer.getChannelData(4), SR = inBuffer.getChannelData(5)
  let oL = outBuffer.getChannelData(0), oR = outBuffer.getChannelData(1)
  for (let i = 0; i < BLOCK_SIZE; i++) { oL[i] += L[i] + 0.7071 * (C[i] + SL[i]); oR[i] += R[i] + 0.7071 * (C[i] + SR[i]) }
}

SPEAKER_MIX[64] = function(inBuffer, outBuffer) { // 5.1 → quad
  let L = inBuffer.getChannelData(0), R = inBuffer.getChannelData(1)
  let C = inBuffer.getChannelData(2), SL = inBuffer.getChannelData(4), SR = inBuffer.getChannelData(5)
  let oL = outBuffer.getChannelData(0), oR = outBuffer.getChannelData(1)
  let oSL = outBuffer.getChannelData(2), oSR = outBuffer.getChannelData(3)
  for (let i = 0; i < BLOCK_SIZE; i++) {
    oL[i] += L[i] + 0.7071 * C[i]; oR[i] += R[i] + 0.7071 * C[i]
    oSL[i] += SL[i]; oSR[i] += SR[i]
  }
}

export default ChannelMixing
