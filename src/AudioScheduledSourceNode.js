import AudioNode from './AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { InvalidStateError } from './errors.js'
import { BLOCK_SIZE } from './constants.js'

class AudioScheduledSourceNode extends AudioNode {

  #onended = null
  get onended() { return this.#onended }
  set onended(fn) {
    if (this.#onended) this.removeEventListener('ended', this.#onended)
    this.#onended = fn
    if (fn) this.addEventListener('ended', fn)
  }

  constructor(context, numberOfInputs, numberOfOutputs, channelCount, channelCountMode, channelInterpretation) {
    super(context, numberOfInputs, numberOfOutputs, channelCount, channelCountMode, channelInterpretation)
    this._playing = false
    this._started = false
    this._zeroBuf = new AudioBuffer(1, BLOCK_SIZE, context.sampleRate)
  }

  start(when = 0) {
    if (when < 0) throw new RangeError('when must be non-negative')
    if (this._started) throw new InvalidStateError('start has already been called')
    this._started = true
    this._schedule('start', when, () => {
      this._playing = true
      this._onStart()
    })
  }

  stop(when = 0) {
    if (when < 0) throw new RangeError('when must be non-negative')
    if (!this._started) throw new InvalidStateError('cannot stop before start')
    this._schedule('stop', when, () => {
      this._playing = false
      this._scheduleEnded()
    })
  }

  // hook for subclasses to initialize on start
  _onStart() {}

  // schedule ended event + dispose
  _scheduleEnded(delay = 0) {
    this._schedule('ended', this.context.currentTime + delay, () => {
      this.dispatchEvent(new Event('ended'))
    })
    this._schedule('kill', this.context.currentTime + delay, () => this[Symbol.dispose]())
  }

  _tick() {
    super._tick()
    if (!this._playing) return this._zeroBuf
    return this._dsp()
  }

  // subclasses override this
  _dsp() { return this._zeroBuf }
}

export default AudioScheduledSourceNode
