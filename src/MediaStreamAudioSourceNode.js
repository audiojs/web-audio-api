import AudioNode from './AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'
import { DOMErr } from './errors.js'

// Reads audio from a readable stream/source and outputs it to the graph
class MediaStreamAudioSourceNode extends AudioNode {

  #stream
  #buffer
  #readPos = 0
  #channelCount

  get mediaStream() { return this.#stream }

  constructor(context, options) {
    options = AudioNode._checkOpts(options)

    // Per spec: must have at least one audio track
    let ms = options.mediaStream
    if (ms) {
      let audioTracks = typeof ms.getAudioTracks === 'function' ? ms.getAudioTracks() : []
      if (audioTracks.length === 0)
        throw DOMErr('MediaStream has no audio tracks', 'InvalidStateError')
    }

    let numberOfChannels = options.numberOfChannels ?? 1
    super(context, 0, 1, numberOfChannels, 'max', 'speakers')
    this.#stream = ms
    this.#channelCount = numberOfChannels
    this.#buffer = [] // accumulated Float32Array chunks per channel
    this._outBuf = new AudioBuffer(numberOfChannels, BLOCK_SIZE, context.sampleRate)
    this._applyOpts(options)
  }

  // Push audio data into the node (called externally or from stream)
  pushData(channelData) {
    this.#buffer.push(channelData)
  }

  _tick() {
    super._tick()
    let out = this._outBuf
    // zero output
    for (let ch = 0; ch < this.#channelCount; ch++) out.getChannelData(ch).fill(0)

    // Pull from stream's _buffers if backed by a MediaStreamAudioDestinationNode
    let stream = this.#stream
    if (stream && stream._buffers && stream._buffers.length > 0 && this.#buffer.length === 0) {
      let chunk = stream._buffers.shift()
      this.#buffer.push(chunk)
    }

    // try to fill from accumulated buffer
    if (this.#buffer.length > 0) {
      let chunk = this.#buffer[0]
      let chCount = Math.min(this.#channelCount, Array.isArray(chunk) ? chunk.length : 1)
      for (let ch = 0; ch < chCount; ch++) {
        let src = Array.isArray(chunk) ? chunk[ch] : chunk
        let dst = out.getChannelData(ch)
        let available = src.length - this.#readPos
        let count = Math.min(BLOCK_SIZE, available)
        for (let i = 0; i < count; i++) dst[i] = src[this.#readPos + i]
      }
      this.#readPos += BLOCK_SIZE
      if (this.#readPos >= (Array.isArray(chunk) ? chunk[0].length : chunk.length)) {
        this.#buffer.shift()
        this.#readPos = 0
      }
    }

    return out
  }
}


// Minimal MediaStreamTrack stub
let _trackIdCounter = 0
class MediaStreamTrack {
  #id
  #kind
  #enabled = true
  #readyState = 'live'
  get id() { return this.#id }
  get kind() { return this.#kind }
  get enabled() { return this.#enabled }
  set enabled(v) { this.#enabled = !!v }
  get readyState() { return this.#readyState }
  stop() { this.#readyState = 'ended' }
  clone() {
    let t = new MediaStreamTrack(this.#kind)
    t.#enabled = this.#enabled
    return t
  }
  constructor(kind = 'audio') { this.#kind = kind; this.#id = 'track-' + (++_trackIdCounter) }
}

// Writes audio graph output to a writable stream/destination
class MediaStreamAudioDestinationNode extends AudioNode {

  #stream

  get stream() { return this.#stream }

  constructor(context, options) {
    options = AudioNode._checkOpts(options)
    let numberOfChannels = options.numberOfChannels ?? 2
    super(context, 1, 0, numberOfChannels, 'explicit', 'speakers')
    // create a simple readable interface with a real audio track
    let track = new MediaStreamTrack('audio')
    this.#stream = {
      _buffers: [],
      _tracks: [track],
      read() { return this._buffers.shift() || null },
      get readable() { return this._buffers.length > 0 },
      getAudioTracks() { return this._tracks.filter(t => t.kind === 'audio') },
      getTracks() { return [...this._tracks] },
      addTrack(t) { if (!this._tracks.includes(t)) this._tracks.push(t) },
      removeTrack(t) { let i = this._tracks.indexOf(t); if (i >= 0) this._tracks.splice(i, 1) },
    }
    this._applyOpts(options)
    // Register as tail node so rendering pulls our input even when not connected to destination
    context._tailNodes?.add(this)
  }

  _tick() {
    super._tick()
    let inBuf = this._inputs[0]._tick()
    // push channel data to stream
    let channels = []
    for (let ch = 0; ch < inBuf.numberOfChannels; ch++)
      channels.push(new Float32Array(inBuf.getChannelData(ch)))
    this.#stream._buffers.push(channels)
    return inBuf
  }
}

// Minimal MediaElementAudioSourceNode — wraps a media element as audio source
class MediaElementAudioSourceNode extends AudioNode {
  #mediaElement

  get mediaElement() { return this.#mediaElement }

  constructor(context, options) {
    options = AudioNode._checkOpts(options)
    super(context, 0, 1, 2, 'max', 'speakers')
    this.#mediaElement = options.mediaElement || null
    this._outBuf = new AudioBuffer(2, BLOCK_SIZE, context.sampleRate)
    this._applyOpts(options)
  }

  _tick() {
    super._tick()
    // Output silence — media element playback is a browser concern
    for (let ch = 0; ch < this._outBuf.numberOfChannels; ch++)
      this._outBuf.getChannelData(ch).fill(0)
    return this._outBuf
  }
}

export { MediaStreamAudioSourceNode, MediaStreamAudioDestinationNode, MediaElementAudioSourceNode }
