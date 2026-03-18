import BaseAudioContext from './BaseAudioContext.js'
import { BufferEncoder } from './utils.js'
import { BLOCK_SIZE } from './constants.js'
import { DOMErr } from './errors.js'

class AudioContext extends BaseAudioContext {
  #loopRunning = false
  #numberOfChannels
  #bitDepth
  #encoder

  constructor(opts) {
    if (opts !== undefined && (typeof opts !== 'object' || opts === null))
      throw new TypeError("Failed to construct 'AudioContext': The provided value is not of type 'AudioContextOptions'.")

    opts = opts || {}

    // Validate latencyHint
    if (opts.latencyHint !== undefined) {
      if (typeof opts.latencyHint === 'string' &&
          !['interactive', 'balanced', 'playback'].includes(opts.latencyHint))
        throw new TypeError("Failed to construct 'AudioContext': Failed to read the 'latencyHint' property from 'AudioContextOptions': The provided value '" + opts.latencyHint + "' is not a valid enum value of type AudioContextLatencyCategory.")
      if (typeof opts.latencyHint !== 'string' && typeof opts.latencyHint !== 'number')
        throw new TypeError("Failed to construct 'AudioContext': Failed to read the 'latencyHint' property from 'AudioContextOptions': The provided value is not of type 'AudioContextLatencyCategory'.")
    }

    // Validate sampleRate
    let sampleRate = opts.sampleRate || 44100
    if (opts.sampleRate !== undefined) {
      if (opts.sampleRate < 3000 || opts.sampleRate > 768000)
        throw DOMErr("Failed to construct 'AudioContext': The sample rate provided (" + opts.sampleRate + ") is outside the range [3000, 768000].", 'NotSupportedError')
      sampleRate = opts.sampleRate
    }

    super(sampleRate, opts.numberOfChannels || 2)
    // Per spec, initial state is 'suspended' until resume() or user activation
    this._state = 'suspended'

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
      if (!this.outStream) return
      this.#loopRunning = true
      this._renderLoop()
    })
  }

  getOutputTimestamp() {
    return { contextTime: this.currentTime, performanceTime: typeof performance !== 'undefined' ? performance.now() : 0 }
  }

  get numberOfChannels() { return this.#numberOfChannels }
  get baseLatency() { return BLOCK_SIZE / this.sampleRate }
  get outputLatency() { return BLOCK_SIZE / this.sampleRate }
  get renderQuantumSize() { return BLOCK_SIZE }

  suspend() {
    if (this._state === 'closed') return Promise.reject(DOMErr('Cannot suspend a closed AudioContext', 'InvalidStateError'))
    this._setState('suspended')
    return Promise.resolve()
  }

  resume() {
    if (this._state === 'closed') return Promise.reject(DOMErr('Cannot resume a closed AudioContext', 'InvalidStateError'))
    this._setState('running')
    if (!this.#loopRunning && this.outStream && this._destination._inputs[0].sources.length) {
      this.#loopRunning = true
      this._renderLoop()
    }
    return Promise.resolve()
  }

  close() {
    if (this._state === 'closed') return Promise.resolve()
    this._setState('closed')
    this._closeStream()
    return Promise.resolve()
  }

  _closeStream() {
    if (this.outStream) (this.outStream.close ?? this.outStream.end)?.call(this.outStream)
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
    this._closeStream()
  }
}

export default AudioContext
