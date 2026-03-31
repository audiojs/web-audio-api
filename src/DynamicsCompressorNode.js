import AudioNode from './AudioNode.js'
import AudioParam from './AudioParam.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'
import { DOMErr } from './errors.js'
import compressor from 'audio-effect/dynamics/compressor.js'


class DynamicsCompressorNode extends AudioNode {

  #threshold
  #knee
  #ratio
  #attack
  #release
  #reduction = 0
  #envelope = -120  // running dB envelope state

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
    let knee      = this.#knee._tick()[0]
    let ratio     = this.#ratio._tick()[0]
    let attack    = this.#attack._tick()[0]
    let release   = this.#release._tick()[0]

    if (ch !== this._outCh) {
      this._outBuf = new AudioBuffer(ch, BLOCK_SIZE, sr)
      this._outCh = ch
    }

    let channels = []
    for (let c = 0; c < ch; c++) {
      let oc = this._outBuf.getChannelData(c)
      oc.set(inBuf.getChannelData(c))
      channels.push(oc)
    }

    let params = { threshold, knee, ratio, attack, release, fs: sr, _env: this.#envelope }
    compressor(channels, params)
    this.#envelope = params._env
    this.#reduction = params._reduction ?? 0

    return this._outBuf
  }
}

export default DynamicsCompressorNode
