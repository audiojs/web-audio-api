import BaseAudioContext from './BaseAudioContext.js'
import { BufferEncoder } from './utils.js'
import { BLOCK_SIZE } from './constants.js'


class AudioContext extends BaseAudioContext {
  #loopRunning = false
  #numberOfChannels
  #bitDepth
  #encoder

  constructor(opts) {
    opts = opts || {}
    super(opts.sampleRate || 44100)
    this._state = 'running'

    this.#numberOfChannels = opts.numberOfChannels || 2
    this.#bitDepth = opts.bitDepth || 16

    this.format = {
      numberOfChannels: this.#numberOfChannels,
      bitDepth: this.#bitDepth,
      sampleRate: this.sampleRate
    }
    if (opts.bufferSize) this.format.bufferSize = opts.bufferSize
    if (opts.numBuffers) this.format.numBuffers = opts.numBuffers

    this.#encoder = BufferEncoder(this.format)
    this.outStream = null

    // When a new connection is established, start to pull audio
    this._destination._inputs[0].on('connection', () => {
      if (this.#loopRunning || this._state !== 'running') return
      if (!this.outStream) throw new Error('you need to set outStream to send the audio somewhere')
      this.#loopRunning = true
      this._renderLoop()
    })
  }

  get numberOfChannels() { return this.#numberOfChannels }
  get baseLatency() { return BLOCK_SIZE / this.sampleRate }
  get outputLatency() { return BLOCK_SIZE / this.sampleRate }

  suspend() {
    return Promise.resolve(this._setState('suspended'))
  }

  resume() {
    return new Promise(resolve => {
      this._setState('running')
      if (!this.#loopRunning && this.outStream && this._destination._inputs[0].sources.length) {
        this.#loopRunning = true
        this._renderLoop()
      }
      resolve()
    })
  }

  close() {
    return new Promise(resolve => {
      this._setState('closed')
      if (this.outStream) (this.outStream.close ?? this.outStream.end)?.call(this.outStream)
      resolve()
    })
  }

  _render() {
    let outBuff = this._renderQuantum()
    return this.#encoder(outBuff._channels)
  }

  _renderLoop() {
    if (this._state !== 'running') { this.#loopRunning = false; return }
    try {
      let encoded = this._render()
      let ok = this.outStream.write(encoded)
      if (ok || !this.outStream.once) setTimeout(() => this._renderLoop(), 0)
      else this.outStream.once('drain', () => this._renderLoop())
    } catch (e) {
      this.#loopRunning = false
      if (e) { let ev = new Event('error'); ev.error = e; this.dispatchEvent(ev) }
    }
  }

  [Symbol.dispose]() {
    this._setState('closed')
    if (this.outStream) (this.outStream.close ?? this.outStream.end)?.call(this.outStream)
  }
}

export default AudioContext
