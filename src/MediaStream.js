import convert from 'pcm-convert'

let nextId = 0
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

export class MediaStreamTrack extends EventTarget {
  id = 'track-' + (++nextId)
  kind
  label
  enabled = true
  readyState = 'live'
  #settings
  _buffers = []

  constructor(kind = 'audio', label = '', settings = {}) {
    super()
    this.kind = kind
    this.label = label
    this.#settings = settings
  }

  stop() {
    if (this.readyState === 'ended') return
    this.readyState = 'ended'
    this.dispatchEvent(new Event('ended'))
  }

  clone() { return new MediaStreamTrack(this.kind, this.label, this.#settings) }

  getSettings() { return { ...this.#settings } }

  pushData(chunk, options = {}) {
    let channels = options.channels ?? options.numberOfChannels ?? this.#settings.channelCount ?? 1
    let bitDepth = options.bitDepth ?? this.#settings.sampleSize ?? 16
    this._buffers.push(normalizeChunk(chunk, channels, bitDepth))
  }
}

export class MediaStream extends EventTarget {
  id = 'stream-' + Math.random().toString(36).slice(2)
  #tracks

  constructor(tracks = []) {
    super()
    this.#tracks = [...(tracks instanceof MediaStream ? tracks.getTracks() : tracks)]
  }

  get active() { return this.#tracks.some(t => t.readyState === 'live') }
  getTracks() { return [...this.#tracks] }
  getAudioTracks() { return this.#tracks.filter(t => t.kind === 'audio') }
  getVideoTracks() { return this.#tracks.filter(t => t.kind === 'video') }
  addTrack(t) { if (!this.#tracks.includes(t)) this.#tracks.push(t) }
  removeTrack(t) { let i = this.#tracks.indexOf(t); if (i >= 0) this.#tracks.splice(i, 1) }
}
