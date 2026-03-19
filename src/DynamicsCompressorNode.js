import AudioNode from './AudioNode.js'
import AudioParam from './AudioParam.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'
import { DOMErr } from './errors.js'


class DynamicsCompressorNode extends AudioNode {

  #threshold
  #knee
  #ratio
  #attack
  #release
  #reduction = 0
  #envelope = -120 // start at silence floor, not 0dB

  get threshold() { return this.#threshold }
  get knee() { return this.#knee }
  get ratio() { return this.#ratio }
  get attack() { return this.#attack }
  get release() { return this.#release }
  get reduction() { return this.#reduction }

  constructor(context, options) {
    options = AudioNode._checkOpts(options)
    super(context, 1, 1, 2, 'clamped-max', 'speakers')
    this.#threshold = new AudioParam(this.context, Math.fround(options.threshold ?? -24), 'k', -100, 0)
    this.#knee = new AudioParam(this.context, Math.fround(options.knee ?? 30), 'k', 0, 40)
    this.#ratio = new AudioParam(this.context, Math.fround(options.ratio ?? 12), 'k', 1, 20)
    this.#attack = new AudioParam(this.context, Math.fround(options.attack ?? 0.003), 'k', 0, 1)
    this.#release = new AudioParam(this.context, Math.fround(options.release ?? 0.25), 'k', 0, 1)
    // DynamicsCompressor params have fixed k-rate per spec
    this.#threshold._fixedRate = true
    this.#knee._fixedRate = true
    this.#ratio._fixedRate = true
    this.#attack._fixedRate = true
    this.#release._fixedRate = true
    this._outBuf = null
    this._outCh = 0
    this._applyOpts(options)
  }

  _validateChannelCount(val) {
    if (val > 2) throw DOMErr('channelCount cannot be greater than 2', 'NotSupportedError')
  }

  _validateChannelCountMode(val) {
    if (val === 'max') throw DOMErr("channelCountMode cannot be 'max'", 'NotSupportedError')
  }

  _tick() {
    super._tick()
    let inBuf = this._inputs[0]._tick()
    let ch = inBuf.numberOfChannels
    let sr = this.context.sampleRate

    let threshold = this.#threshold._tick()[0]
    let knee = this.#knee._tick()[0]
    let ratio = this.#ratio._tick()[0]
    let attack = this.#attack._tick()[0]
    let release = this.#release._tick()[0]

    if (ch !== this._outCh) {
      this._outBuf = new AudioBuffer(ch, BLOCK_SIZE, sr)
      this._outCh = ch
    }

    let attackCoeff = attack > 0 ? Math.exp(-1 / (attack * sr)) : 0
    let releaseCoeff = release > 0 ? Math.exp(-1 / (release * sr)) : 0
    if (knee < 0) knee = 0
    let halfKnee = knee / 2
    if (ratio <= 0) ratio = 1 // guard against divide-by-zero
    let env = this.#envelope

    for (let i = 0; i < BLOCK_SIZE; i++) {
      // detect peak across all channels
      let peak = 0
      for (let c = 0; c < ch; c++)
        peak = Math.max(peak, Math.abs(inBuf.getChannelData(c)[i]))

      let dB = peak > 0 ? 20 * Math.log10(peak) : -120

      // envelope follower
      let coeff = dB > env ? attackCoeff : releaseCoeff
      env = coeff * env + (1 - coeff) * dB

      // compute gain reduction
      let overshoot = env - threshold
      let gainReduction = 0
      if (overshoot <= -halfKnee) {
        gainReduction = 0
      } else if (overshoot >= halfKnee) {
        gainReduction = overshoot * (1 - 1 / ratio)
      } else if (knee > 0) {
        // soft knee
        let x = overshoot + halfKnee
        gainReduction = (x * x) / (4 * knee) * (1 - 1 / ratio)
      }

      let gainLin = Math.pow(10, -gainReduction / 20)

      for (let c = 0; c < ch; c++)
        this._outBuf.getChannelData(c)[i] = inBuf.getChannelData(c)[i] * gainLin

      this.#reduction = -gainReduction
    }

    this.#envelope = env
    return this._outBuf
  }
}

export default DynamicsCompressorNode
