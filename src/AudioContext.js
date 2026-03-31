import BaseAudioContext from './BaseAudioContext.js'
import Speaker from 'audio-speaker'
import convert from 'pcm-convert'
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
  #speaker = null  // audio-speaker write function (default output)
  #stream = null   // writable stream sink (when sinkId is a stream)
  #loopDeferred = false
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
    let sinkId = opts.sinkId
    if (sinkId !== undefined) {
      if (typeof sinkId === 'object' && sinkId !== null && typeof sinkId.write !== 'function') {
        if (sinkId.type !== 'none')
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
    if (sinkId !== undefined) {
      if (typeof sinkId === 'object' && sinkId !== null) {
        if (typeof sinkId.write === 'function') {
          this.#stream = sinkId
        } else {
          this.#sinkId = { type: sinkId.type }
        }
      } else if (typeof sinkId === 'string') {
        let known = this.constructor._knownDeviceIds || AudioContext._knownDeviceIds
        if (sinkId !== '' && known && !known.has(sinkId)) {
          setTimeout(() => this.dispatchEvent(new Event('error')), 0)
        } else {
          this.#sinkId = sinkId
        }
      }
    }

    let format = {
      numberOfChannels: this.#numberOfChannels,
      bitDepth: this.#bitDepth,
      sampleRate: this.sampleRate
    }
    if (opts.bufferSize) format.bufferSize = opts.bufferSize
    if (opts.numBuffers) format.numBuffers = opts.numBuffers

    let dtype = 'int' + this.#bitDepth
    this.#encoder = channels => new Uint8Array(convert(channels, 'float32 planar', `${dtype} interleaved le`).buffer)

    // Start render loop when a connection is established.
    // Deferred via queueMicrotask so user can finish setting up the graph
    // (connect + start) before rendering begins.
    this._destination._inputs[0].on('connection', () => {
      if (this.#loopRunning || this.#loopDeferred || this._state !== 'running') return
      if (!this.#stream && !this.#speaker) return
      this.#loopDeferred = true
      queueMicrotask(() => {
        this.#loopDeferred = false
        if (this.#loopRunning || this._state !== 'running') return
        this.#loopRunning = true
        this._renderLoop()
      })
    })
  }

  getOutputTimestamp() {
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
      if (typeof sinkId.write === 'function') {
        // Writable stream as sink
        if (this.#speaker) { this.#speaker.close(); this.#speaker = null }
        let prev = this.#stream
        this.#stream = sinkId
        if (prev !== sinkId) this.dispatchEvent(new Event('sinkchange'))
        return Promise.resolve()
      }
      if (sinkId.type !== 'none')
        return Promise.reject(new TypeError('Invalid AudioSinkOptions.type value.'))
      let prev = this.#sinkId
      this.#sinkId = { type: sinkId.type }
      if (typeof prev !== 'object' || prev?.type !== sinkId.type)
        this.dispatchEvent(new Event('sinkchange'))
      return Promise.resolve()
    }
    if (typeof sinkId === 'string') {
      if (sinkId !== '' && sinkId !== this.#sinkId) {
        let known = this.constructor._knownDeviceIds || AudioContext._knownDeviceIds
        if (known && !known.has(sinkId))
          return Promise.reject(DOMErr('Device not found: ' + sinkId, 'NotFoundError'))
      }
      let prev = this.#sinkId
      let self = this
      return new Promise(resolve => {
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

  async resume() {
    if (this._discarded) return Promise.reject(DOMErr('Document is not fully active', 'InvalidStateError'))
    if (this._state === 'closed') return Promise.reject(DOMErr('Cannot resume a closed AudioContext', 'InvalidStateError'))
    // Create speaker eagerly on resume — starts device with silence so there's
    // no hardware pop when audio actually begins (same as browsers).
    let isNone = typeof this.#sinkId === 'object' && this.#sinkId?.type === 'none'
    if (!this.#stream && !this.#speaker && !isNone) {
      this.#speaker = await Speaker({
        sampleRate: this.sampleRate,
        channels: this.#numberOfChannels,
        bitDepth: this.#bitDepth
      })
    }
    this._setState('running')
    if (!this.#loopRunning && (this.#speaker || this.#stream) && this._destination._inputs[0].sources.length) {
      this.#loopRunning = true
      this._renderLoop()
    }
  }

  close() {
    if (this._discarded) return Promise.reject(DOMErr('Document is not fully active', 'InvalidStateError'))
    if (this._state === 'closed') return Promise.resolve()
    this._setState('closed')
    this._closeOutput()
    return Promise.resolve()
  }

  _closeOutput() {
    if (this.#speaker) { this.#speaker.close(); this.#speaker = null }
    if (this.#stream) { (this.#stream.close ?? this.#stream.end)?.call(this.#stream); this.#stream = null }
  }

  _renderLoop() {
    if (this._state !== 'running') {
      this.#loopRunning = false
      return
    }
    try {
      let buf = this._renderQuantum()

      let nch = buf.numberOfChannels
      let channels = []
      for (let c = 0; c < nch; c++) channels.push(buf.getChannelData(c))
      let encoded = this.#encoder(channels)

      if (this.#speaker) {
        this.#speaker(encoded, () => this._renderLoop())
      } else if (this.#stream) {
        let ok = this.#stream.write(encoded)
        if (ok || !this.#stream.once) setTimeout(() => this._renderLoop(), 0)
        else this.#stream.once('drain', () => this._renderLoop())
      }
    } catch (e) {
      console.error('AudioContext render error:', e)
      this.#loopRunning = false
      if (e) { let ev = new Event('error'); ev.error = e; this.dispatchEvent(ev) }
    }
  }

  [Symbol.dispose]() {
    this._setState('closed')
    this._closeOutput()
  }
}

export default AudioContext
