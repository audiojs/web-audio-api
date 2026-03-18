import AudioNode from './AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { NotSupportedError, InvalidStateError, InvalidAccessError } from './errors.js'
import { BLOCK_SIZE } from './constants.js'

const MAX_COEF = 20

class IIRFilterNode extends AudioNode {

  #feedforward
  #feedback
  #state // per-channel state

  constructor(context, options) {
    if (!(context && typeof context === 'object' && 'sampleRate' in context))
      throw new TypeError('First argument must be an AudioContext')
    if (!options || typeof options !== 'object')
      throw new TypeError('Second argument must be an IIRFilterOptions dictionary')

    let feedforward = options.feedforward
    let feedback = options.feedback

    // Required members per spec
    if (feedforward === undefined || feedforward === null)
      throw new TypeError('feedforward is required')
    if (feedback === undefined || feedback === null)
      throw new TypeError('feedback is required')

    // Convert to array (handles TypedArrays, array-like)
    feedforward = Array.from(feedforward)
    feedback = Array.from(feedback)

    // Non-finite check (TypeError per spec) - must come before length checks
    for (let i = 0; i < feedforward.length; i++) {
      let v = +feedforward[i]
      if (!Number.isFinite(v))
        throw new TypeError('feedforward coefficient at index ' + i + ' is not finite')
      feedforward[i] = v
    }
    for (let i = 0; i < feedback.length; i++) {
      let v = +feedback[i]
      if (!Number.isFinite(v))
        throw new TypeError('feedback coefficient at index ' + i + ' is not finite')
      feedback[i] = v
    }

    // Empty arrays -> NotSupportedError
    if (feedforward.length === 0)
      throw new NotSupportedError('feedforward must not be empty')
    if (feedback.length === 0)
      throw new NotSupportedError('feedback must not be empty')

    // Max 20 coefficients -> NotSupportedError
    if (feedforward.length > MAX_COEF)
      throw new NotSupportedError('feedforward length exceeds ' + MAX_COEF)
    if (feedback.length > MAX_COEF)
      throw new NotSupportedError('feedback length exceeds ' + MAX_COEF)

    // All-zero feedforward -> InvalidStateError
    if (feedforward.every(v => v === 0))
      throw new InvalidStateError('feedforward coefficients must not all be zero')

    // feedback[0] === 0 -> InvalidStateError
    if (feedback[0] === 0)
      throw new InvalidStateError('feedback[0] must be non-zero')

    super(context, 1, 1, undefined, 'max', 'speakers')
    this._applyOpts(options)

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
    // Null/undefined check per spec -> TypeError
    if (!frequencyHz || !(frequencyHz instanceof Float32Array))
      throw new TypeError('frequencyHz must be a Float32Array')
    if (!magResponse || !(magResponse instanceof Float32Array))
      throw new TypeError('magResponse must be a Float32Array')
    if (!phaseResponse || !(phaseResponse instanceof Float32Array))
      throw new TypeError('phaseResponse must be a Float32Array')

    // Length mismatch -> InvalidAccessError
    if (magResponse.length < frequencyHz.length)
      throw new InvalidAccessError('magResponse length must be >= frequencyHz length')
    if (phaseResponse.length < frequencyHz.length)
      throw new InvalidAccessError('phaseResponse length must be >= frequencyHz length')

    let sr = this.context.sampleRate
    let nyquist = sr / 2
    let ff = this.#feedforward, fb = this.#feedback

    for (let i = 0; i < frequencyHz.length; i++) {
      let freq = frequencyHz[i]

      // Out-of-range frequencies (< 0 or > Nyquist) -> NaN per spec
      if (freq < 0 || freq > nyquist) {
        magResponse[i] = NaN
        phaseResponse[i] = NaN
        continue
      }

      let w = 2 * Math.PI * freq / sr
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
