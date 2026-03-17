import AudioNode from './AudioNode.js'
import AudioParam from './AudioParam.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'

// W3C spec equal-power panning:
// For mono input:  outputL = input * cos(x), outputR = input * sin(x)
//   where x = (pan + 1) / 2 * π/2
// For stereo input (continuous at pan=0, identity at pan=0):
//   If pan < 0:  x = -pan * π/2; outputL = inputL + inputR * sin(x), outputR = inputR * cos(x)
//   If pan >= 0: x = pan * π/2;  outputL = inputL * cos(x), outputR = inputR + inputL * sin(x)

class StereoPannerNode extends AudioNode {

  #pan
  get pan() { return this.#pan }

  constructor(context) {
    super(context, 1, 1, 2, 'clamped-max', 'speakers')
    this.#pan = new AudioParam(this.context, 0, 'a')
    this._outBuf = new AudioBuffer(2, BLOCK_SIZE, context.sampleRate)
  }

  _tick() {
    super._tick()
    let inBuf = this._inputs[0]._tick()
    let panArr = this.#pan._tick()
    let outL = this._outBuf.getChannelData(0)
    let outR = this._outBuf.getChannelData(1)
    let inCh = inBuf.numberOfChannels
    let PI2 = Math.PI / 2

    if (inCh === 1) {
      let inp = inBuf.getChannelData(0)
      for (let i = 0; i < BLOCK_SIZE; i++) {
        let p = Math.max(-1, Math.min(1, panArr[i]))
        let x = (p + 1) / 2 * PI2
        outL[i] = inp[i] * Math.cos(x)
        outR[i] = inp[i] * Math.sin(x)
      }
    } else {
      let inL = inBuf.getChannelData(0), inR = inBuf.getChannelData(1)
      for (let i = 0; i < BLOCK_SIZE; i++) {
        let p = Math.max(-1, Math.min(1, panArr[i]))
        if (p < 0) {
          let x = -p * PI2
          outL[i] = inL[i] + inR[i] * Math.sin(x)
          outR[i] = inR[i] * Math.cos(x)
        } else {
          let x = p * PI2
          outL[i] = inL[i] * Math.cos(x)
          outR[i] = inR[i] + inL[i] * Math.sin(x)
        }
      }
    }

    return this._outBuf
  }
}

export default StereoPannerNode
