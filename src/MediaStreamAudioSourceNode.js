import AudioNode from './AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'
import { DOMErr } from './errors.js'
import { MediaStreamTrack } from './MediaStream.js'

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

    let track = ms?.getAudioTracks?.()[0]
    let settings = track?.getSettings?.()
    let channels = options.numberOfChannels ?? settings?.channelCount ?? 1
    super(context, 0, 1, channels, 'max', 'speakers')
    this.#stream = ms
    this.#channels = channels
    this._outBuf = new AudioBuffer(channels, BLOCK_SIZE, context.sampleRate)
    this._applyOpts(options)
  }

  _tick() {
    super._tick()
    let out = this._outBuf
    for (let ch = 0; ch < this.#channels; ch++) out.getChannelData(ch).fill(0)

    let track = this.#stream?.getAudioTracks?.()[0]

    // go silent and clear state if track has ended
    if (track?.readyState === 'ended') {
      this.#pending = null
      this.#pos = 0
      return out
    }

    // go silent without draining if track is disabled (resumes on re-enable)
    if (track && !track.enabled) return out

    let buffers = track?._buffers ?? this.#stream?._buffers

    let offset = 0
    while (offset < BLOCK_SIZE) {
      if (!this.#pending) this.#pending = buffers?.shift() ?? null
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
    let track = new MediaStreamTrack('audio', '', { channelCount: channels, sampleRate: context.sampleRate })
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
