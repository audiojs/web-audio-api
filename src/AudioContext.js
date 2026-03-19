import BaseAudioContext from './BaseAudioContext.js'
import { BufferEncoder } from './utils.js'
import { BLOCK_SIZE } from './constants.js'
import { DOMErr } from './errors.js'

// Stub stats object for playbackStats / playoutStats
class PlaybackStats {
  totalDuration = 0; underrunDuration = 0; underrunEvents = 0
  minimumLatency = 0; maximumLatency = 0; averageLatency = 0
  resetLatency() { this.minimumLatency = this.averageLatency; this.maximumLatency = this.averageLatency }
  toJSON() { return { totalDuration: this.totalDuration, underrunDuration: this.underrunDuration, underrunEvents: this.underrunEvents, minimumLatency: this.minimumLatency, maximumLatency: this.maximumLatency, averageLatency: this.averageLatency } }
}
class PlayoutStats {
  totalFramesDuration = 0; fallbackFramesDuration = 0; fallbackFramesEvents = 0
  minimumLatency = 0; maximumLatency = 0; averageLatency = 0
  resetLatency() { this.minimumLatency = this.averageLatency; this.maximumLatency = this.averageLatency }
  toJSON() { return { totalFramesDuration: this.totalFramesDuration, fallbackFramesDuration: this.fallbackFramesDuration, fallbackFramesEvents: this.fallbackFramesEvents, minimumLatency: this.minimumLatency, maximumLatency: this.maximumLatency, averageLatency: this.averageLatency } }
}

class AudioContext extends BaseAudioContext {
  #loopRunning = false
  #numberOfChannels
  #bitDepth
  #encoder
  #sinkId = ''
  #playbackStats = new PlaybackStats()
  #playoutStats = new PlayoutStats()
  #renderQuantumSize
  #onsinkchange = null

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

    // Validate renderSizeHint
    let renderQuantumSize = BLOCK_SIZE
    if (opts.renderSizeHint !== undefined) {
      let hint = opts.renderSizeHint
      if (hint === 'default' || hint === 'hardware') {
        renderQuantumSize = BLOCK_SIZE
      } else if (typeof hint === 'number') {
        let maxSize = sampleRate * 6
        if (hint < 1 || hint > maxSize)
          throw DOMErr("Failed to construct 'AudioContext': renderSizeHint " + hint + " is out of range.", 'NotSupportedError')
        renderQuantumSize = hint
      }
    }

    // Validate sinkId option
    if (opts.sinkId !== undefined) {
      if (typeof opts.sinkId === 'object' && opts.sinkId !== null) {
        if (opts.sinkId.type !== 'none')
          throw new TypeError("Failed to construct 'AudioContext': Invalid AudioSinkOptions.type value.")
      }
    }

    super(sampleRate, opts.numberOfChannels || 2)
    // Per spec, initial state is 'suspended' until resume() or user activation
    this._state = 'suspended'

    this.#renderQuantumSize = renderQuantumSize
    this.#numberOfChannels = opts.numberOfChannels || 2
    this.#bitDepth = opts.bitDepth || 16

    // Handle sinkId from constructor options
    if (opts.sinkId !== undefined) {
      if (typeof opts.sinkId === 'object' && opts.sinkId !== null) {
        this.#sinkId = { type: opts.sinkId.type }
      } else if (typeof opts.sinkId === 'string') {
        // Validate against known devices if a registry exists
        let known = this.constructor._knownDeviceIds || AudioContext._knownDeviceIds
        if (opts.sinkId !== '' && known && !known.has(opts.sinkId)) {
          // Invalid device ID: dispatch onerror asynchronously per spec
          setTimeout(() => this.dispatchEvent(new Event('error')), 0)
        } else {
          this.#sinkId = opts.sinkId
        }
      }
    }

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
    // performanceTime = 0 when no audio has been rendered, otherwise reflects
    // the performance time at which the current audio frame was output
    if (this.currentTime === 0) return { contextTime: 0, performanceTime: 0 }
    let perf = typeof performance !== 'undefined' ? performance.now() : Date.now()
    return { contextTime: this.currentTime, performanceTime: perf }
  }

  get numberOfChannels() { return this.#numberOfChannels }
  get baseLatency() { return BLOCK_SIZE / this.sampleRate }
  get outputLatency() { return BLOCK_SIZE / this.sampleRate }
  get renderQuantumSize() { return this.#renderQuantumSize }

  get sinkId() { return this.#sinkId }
  get playbackStats() { return this.#playbackStats }
  get playoutStats() { return this.#playoutStats }

  get onsinkchange() { return this.#onsinkchange }
  set onsinkchange(fn) {
    if (this.#onsinkchange) this.removeEventListener('sinkchange', this.#onsinkchange)
    this.#onsinkchange = fn
    if (fn) this.addEventListener('sinkchange', fn)
  }

  setSinkId(sinkId) {
    if (this._discarded)
      return Promise.reject(DOMErr('Document is not fully active', 'InvalidStateError'))
    if (this._state === 'closed')
      return Promise.reject(DOMErr('Cannot setSinkId on a closed AudioContext', 'InvalidStateError'))
    if (typeof sinkId === 'object' && sinkId !== null) {
      if (sinkId.type !== 'none')
        return Promise.reject(new TypeError('Invalid AudioSinkOptions.type value.'))
      let prev = this.#sinkId
      this.#sinkId = { type: sinkId.type }
      if (typeof prev !== 'object' || prev?.type !== sinkId.type)
        this.dispatchEvent(new Event('sinkchange'))
      return Promise.resolve()
    }
    if (typeof sinkId === 'string') {
      // Empty string = default device, always valid
      if (sinkId !== '' && sinkId !== this.#sinkId) {
        let known = this.constructor._knownDeviceIds || AudioContext._knownDeviceIds
        if (known && !known.has(sinkId))
          return Promise.reject(DOMErr('Device not found: ' + sinkId, 'NotFoundError'))
      }
      // Spec: sinkId only updates when the promise resolves (not before)
      let prev = this.#sinkId
      let self = this
      return new Promise(resolve => {
        // Use setTimeout to ensure the test can check sinkId before it changes
        setTimeout(() => {
          self.#sinkId = sinkId
          if (prev !== sinkId) self.dispatchEvent(new Event('sinkchange'))
          resolve()
        }, 0)
      })
    }
    return Promise.reject(new TypeError('Invalid sinkId type'))
  }

  suspend() {
    if (this._discarded) return Promise.reject(DOMErr('Document is not fully active', 'InvalidStateError'))
    if (this._state === 'closed') return Promise.reject(DOMErr('Cannot suspend a closed AudioContext', 'InvalidStateError'))
    this._setState('suspended')
    return Promise.resolve()
  }

  resume() {
    if (this._discarded) return Promise.reject(DOMErr('Document is not fully active', 'InvalidStateError'))
    if (this._state === 'closed') return Promise.reject(DOMErr('Cannot resume a closed AudioContext', 'InvalidStateError'))
    this._setState('running')
    if (!this.#loopRunning && this.outStream && this._destination._inputs[0].sources.length) {
      this.#loopRunning = true
      this._renderLoop()
    }
    return Promise.resolve()
  }

  close() {
    if (this._discarded) return Promise.reject(DOMErr('Document is not fully active', 'InvalidStateError'))
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
