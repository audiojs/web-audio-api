import AudioNode from './AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'

class IIRFilterNode extends AudioNode {

  #feedforward
  #feedback
  #state // per-channel state

  constructor(context, feedforward, feedback) {
    super(context, 1, 1, undefined, 'max', 'speakers')
    if (!feedforward?.length || !feedback?.length) throw new Error('feedforward and feedback must be non-empty')
    if (feedback[0] === 0) throw new Error('feedback[0] must be non-zero')
    this.#feedforward = Float64Array.from(feedforward)
    this.#feedback = Float64Array.from(feedback)
    // normalize by a0
    let a0 = this.#feedback[0]
    if (a0 !== 1) {
      for (let i = 0; i < this.#feedforward.length; i++) this.#feedforward[i] /= a0
      for (let i = 0; i < this.#feedback.length; i++) this.#feedback[i] /= a0
    }
    this.#state = []
    this._outBuf = null
    this._outCh = 0
  }

  getFrequencyResponse(frequencyHz, magResponse, phaseResponse) {
    let sr = this.context.sampleRate
    let ff = this.#feedforward, fb = this.#feedback

    for (let i = 0; i < frequencyHz.length; i++) {
      let w = 2 * Math.PI * frequencyHz[i] / sr
      let numR = 0, numI = 0, denR = 0, denI = 0

      for (let k = 0; k < ff.length; k++) {
        numR += ff[k] * Math.cos(k * w)
        numI -= ff[k] * Math.sin(k * w)
      }
      for (let k = 0; k < fb.length; k++) {
        denR += fb[k] * Math.cos(k * w)
        denI -= fb[k] * Math.sin(k * w)
      }

      let denMag = denR * denR + denI * denI
      let realPart = (numR * denR + numI * denI) / denMag
      let imagPart = (numI * denR - numR * denI) / denMag

      magResponse[i] = Math.sqrt(realPart * realPart + imagPart * imagPart)
      phaseResponse[i] = Math.atan2(imagPart, realPart)
    }
  }

  _tick() {
    super._tick()
    let inBuf = this._inputs[0]._tick()
    let ch = inBuf.numberOfChannels
    let sr = this.context.sampleRate
    let ff = this.#feedforward, fb = this.#feedback
    let order = Math.max(ff.length, fb.length)

    if (ch !== this._outCh) {
      this._outBuf = new AudioBuffer(ch, BLOCK_SIZE, sr)
      this._outCh = ch
      this.#state = Array.from({ length: ch }, () => new Float64Array(order))
    }

    // Direct Form II Transposed
    for (let c = 0; c < ch; c++) {
      let inp = inBuf.getChannelData(c)
      let out = this._outBuf.getChannelData(c)
      let w = this.#state[c]

      for (let i = 0; i < BLOCK_SIZE; i++) {
        let x = inp[i]
        let y = ff[0] * x + w[0]

        for (let j = 0; j < order - 1; j++) {
          w[j] = (j + 1 < ff.length ? ff[j + 1] * x : 0)
               - (j + 1 < fb.length ? fb[j + 1] * y : 0)
               + (j + 1 < order ? w[j + 1] : 0)
        }

        out[i] = y
      }
    }

    return this._outBuf
  }
}

export default IIRFilterNode
