import AudioNode from './AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'
import { DOMErr } from './errors.js'

// Make a minimal MediaStreamTrack-shaped object (used by destination node below)
let nextId = 0
let makeTrack = (kind = 'audio') => ({
  id: 'track-' + (++nextId), kind, enabled: true, readyState: 'live',
  stop() { this.readyState = 'ended' },
  clone() { return makeTrack(this.kind) },
})

// Reads audio from a MediaStream-shaped source into the graph
class MediaStreamAudioSourceNode extends AudioNode {
  #stream
  #pending = null  // current chunk being drained
  #pos = 0
  #channels

  get mediaStream() { return this.#stream }

  constructor(context, options) {
    options = AudioNode._checkOpts(options)
    let ms = options.mediaStream
    if (ms && (ms.getAudioTracks?.() ?? []).length === 0)
      throw DOMErr('MediaStream has no audio tracks', 'InvalidStateError')

    let channels = options.numberOfChannels ?? 1
    super(context, 0, 1, channels, 'max', 'speakers')
    this.#stream = ms
    this.#channels = channels
    this._outBuf = new AudioBuffer(channels, BLOCK_SIZE, context.sampleRate)
    this._applyOpts(options)
  }

  // For tests / external pushers: enqueue a chunk directly onto the stream's buffer.
  pushData(chunk) { (this.#stream ??= { _buffers: [] })._buffers ??= []; this.#stream._buffers.push(chunk) }

  _tick() {
    super._tick()
    let out = this._outBuf
    for (let ch = 0; ch < this.#channels; ch++) out.getChannelData(ch).fill(0)

    if (!this.#pending) this.#pending = this.#stream?._buffers?.shift() ?? null
    if (!this.#pending) return out

    let chunk = this.#pending
    let len = Array.isArray(chunk) ? chunk[0].length : chunk.length
    let count = Math.min(BLOCK_SIZE, len - this.#pos)
    for (let ch = 0; ch < Math.min(this.#channels, Array.isArray(chunk) ? chunk.length : 1); ch++) {
      let src = Array.isArray(chunk) ? chunk[ch] : chunk
      let dst = out.getChannelData(ch)
      for (let i = 0; i < count; i++) dst[i] = src[this.#pos + i]
    }
    this.#pos += count
    if (this.#pos >= len) { this.#pending = null; this.#pos = 0 }
    return out
  }
}

// Captures graph output into a MediaStream for external consumers.
class MediaStreamAudioDestinationNode extends AudioNode {
  #stream
  get stream() { return this.#stream }

  constructor(context, options) {
    options = AudioNode._checkOpts(options)
    let channels = options.numberOfChannels ?? 2
    super(context, 1, 0, channels, 'explicit', 'speakers')
    let track = makeTrack('audio')
    this.#stream = {
      _buffers: [],
      read() { return this._buffers.shift() || null },
      get readable() { return this._buffers.length > 0 },
      getTracks: () => [track],
      getAudioTracks: () => [track],
      getVideoTracks: () => [],
    }
    this._applyOpts(options)
    context._tailNodes?.add(this)
  }

  _tick() {
    super._tick()
    let inBuf = this._inputs[0]._tick()
    let chunk = []
    for (let ch = 0; ch < inBuf.numberOfChannels; ch++) chunk.push(new Float32Array(inBuf.getChannelData(ch)))
    this.#stream._buffers.push(chunk)
    return inBuf
  }
}

// Silent stub — real media element playback is a browser concern.
class MediaElementAudioSourceNode extends AudioNode {
  #el
  get mediaElement() { return this.#el }
  constructor(context, options) {
    options = AudioNode._checkOpts(options)
    super(context, 0, 1, 2, 'max', 'speakers')
    this.#el = options.mediaElement ?? null
    this._outBuf = new AudioBuffer(2, BLOCK_SIZE, context.sampleRate)
    this._applyOpts(options)
  }
  _tick() {
    super._tick()
    for (let ch = 0; ch < this._outBuf.numberOfChannels; ch++) this._outBuf.getChannelData(ch).fill(0)
    return this._outBuf
  }
}

export { MediaStreamAudioSourceNode, MediaStreamAudioDestinationNode, MediaElementAudioSourceNode }
