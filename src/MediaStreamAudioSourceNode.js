import AudioNode from './AudioNode.js'
import AudioBuffer from 'audio-buffer'
import convert from 'pcm-convert'
import { BLOCK_SIZE } from './constants.js'
import { DOMErr } from './errors.js'

// Make a minimal MediaStreamTrack-shaped object (used by destination node below)
let nextId = 0
let makeTrack = (kind = 'audio', settings = {}) => ({
  id: 'track-' + (++nextId), kind, enabled: true, readyState: 'live',
  stop() { this.readyState = 'ended' },
  clone() { return makeTrack(this.kind, settings) },
  getSettings: () => ({ ...settings }),
})

let splitPlanar = (data, channels) => {
  if (channels === 1) return data
  let frames = data.length / channels
  let planes = []
  for (let ch = 0; ch < channels; ch++) planes.push(data.subarray(ch * frames, (ch + 1) * frames))
  return planes
}

let isFloatChunk = chunk =>
  chunk instanceof Float32Array ||
  (Array.isArray(chunk) && chunk.every(ch => ch instanceof Float32Array))

let normalizeChunk = (chunk, channels, bitDepth) => {
  if (isFloatChunk(chunk)) return chunk
  if (![8, 16, 32].includes(bitDepth))
    throw new TypeError('pushData PCM conversion supports 8, 16, or 32-bit integer samples')
  if (!chunk?.buffer && !(chunk instanceof ArrayBuffer))
    throw new TypeError('pushData expects Float32Array, Float32Array[], or interleaved PCM data')

  let bytes = chunk instanceof ArrayBuffer
    ? chunk
    : chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength)
  let data = convert(bytes, { dtype: `int${bitDepth}`, channels, interleaved: true, endianness: 'le' },
    { dtype: 'float32', channels, interleaved: false })
  return splitPlanar(data, channels)
}

// Reads audio from a MediaStream-shaped source into the graph
class MediaStreamAudioSourceNode extends AudioNode {
  #stream
  #pending = null  // current chunk being drained
  #pos = 0
  #channels
  #bitDepth

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
    this.#bitDepth = options.bitDepth ?? 16
    this._outBuf = new AudioBuffer(channels, BLOCK_SIZE, context.sampleRate)
    this._applyOpts(options)
  }

  pushData(chunk, options = {}) {
    ;(this.#stream ??= { _buffers: [] })._buffers ??= []
    this.#stream._buffers.push(normalizeChunk(
      chunk,
      options.channels ?? options.numberOfChannels ?? this.#channels,
      options.bitDepth ?? this.#bitDepth
    ))
  }

  _tick() {
    super._tick()
    let out = this._outBuf
    for (let ch = 0; ch < this.#channels; ch++) out.getChannelData(ch).fill(0)

    let offset = 0
    while (offset < BLOCK_SIZE) {
      if (!this.#pending) this.#pending = this.#stream?._buffers?.shift() ?? null
      if (!this.#pending) break

      let chunk = this.#pending
      let len = Array.isArray(chunk) ? chunk[0]?.length ?? 0 : chunk.length
      if (this.#pos >= len) {
        this.#pending = null
        this.#pos = 0
        continue
      }

      let count = Math.min(BLOCK_SIZE - offset, len - this.#pos)
      for (let ch = 0; ch < Math.min(this.#channels, Array.isArray(chunk) ? chunk.length : 1); ch++) {
        let src = Array.isArray(chunk) ? chunk[ch] : chunk
        let dst = out.getChannelData(ch)
        for (let i = 0; i < count; i++) dst[offset + i] = src[this.#pos + i]
      }

      offset += count
      this.#pos += count
      if (this.#pos >= len) {
        this.#pending = null
        this.#pos = 0
      }
    }
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
    let track = makeTrack('audio', { channelCount: channels, sampleRate: context.sampleRate })
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
