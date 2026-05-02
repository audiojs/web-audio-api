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

// Per W3C Media Capture spec, MediaStreamTrack has no public constructor.
// We provide one as base class for subclassing (like CanvasCaptureMediaStreamTrack).
export class MediaStreamTrack extends EventTarget {
  id = 'track-' + (++nextId)
  #kind = 'audio'
  #label = ''
  enabled = true
  #readyState = 'live'
  #settings = {}

  constructor(kind = 'audio', label = '', settings = {}) {
    super()
    this.#kind = kind
    this.#label = label
    this.#settings = settings
  }

  get kind() { return this.#kind }

  get label() { return this.#label }

  get readyState() { return this.#readyState }

  stop() {
    if (this.#readyState === 'ended') return
    this.#readyState = 'ended'
  }

  clone() {
    let track = new MediaStreamTrack(this.kind, this.label, this.#settings)
    track.enabled = this.enabled
    if (this.#readyState === 'ended') track.#readyState = 'ended'
    return track
  }

  getSettings() { return { ...this.#settings } }
}

// Node extension: custom track with public constructor and pushData().
// Prior art: CanvasCaptureMediaStreamTrack extends MediaStreamTrack.
export class CustomMediaStreamTrack extends MediaStreamTrack {
  _buffers = []
  // WeakRef-based fan-out: clones can be GC'd when no external reference is held.
  #clones = new Set()  // Set<WeakRef<CustomMediaStreamTrack>>
  #registry = new FinalizationRegistry(ref => this.#clones.delete(ref))

  constructor({ kind = 'audio', label = '', settings = {} } = {}) {
    super(kind, label, settings)
  }

  // Internal: fan out an already-normalised chunk to this track and all live clones.
  _pushNormalized(chunk) {
    this._buffers.push(chunk)
    for (let ref of this.#clones) {
      let clone = ref.deref()
      if (clone) clone._pushNormalized(chunk)
      else this.#clones.delete(ref)
    }
  }

  pushData(chunk, options = {}) {
    if (this.readyState === 'ended') return
    let settings = this.getSettings()
    let channels = options.channels ?? options.numberOfChannels ?? settings.channelCount ?? 1
    let bitDepth = options.bitDepth ?? settings.sampleSize ?? settings.bitDepth ?? 16
    this._pushNormalized(normalizeChunk(chunk, channels, bitDepth))
  }

  clone() {
    let clone = new CustomMediaStreamTrack({ kind: this.kind, label: this.label, settings: this.getSettings() })
    let ref = new WeakRef(clone)
    this.#clones.add(ref)
    this.#registry.register(clone, ref, clone)

    let stopCloneWhenSourceEnds = () => {
      if (clone.readyState !== 'ended') clone.stop()
    }

    // Clones are fed through this source track, so they must end when the source ends.
    this.addEventListener('ended', stopCloneWhenSourceEnds, { once: true })

    // Also eagerly clean up when the clone is explicitly stopped or is ended via the source.
    clone.addEventListener('ended', () => {
      this.#registry.unregister(clone)
      this.#clones.delete(ref)
    }, { once: true })

    if (this.readyState === 'ended') stopCloneWhenSourceEnds()

    return clone
  }
}

export class MediaStream extends EventTarget {
  id = 'stream-' + Math.random().toString(36).slice(2)
  #tracks

  constructor(tracks = []) {
    super()
    this.#tracks = [...(tracks instanceof MediaStream ? tracks.getTracks() : tracks)]
  }

  #dispatchTrackEvent(type, track) {
    let event = new Event(type)
    Object.defineProperty(event, 'track', { value: track, enumerable: true })
    this.dispatchEvent(event)
  }

  get active() { return this.#tracks.some(t => t.readyState === 'live') }
  getTracks() { return [...this.#tracks] }
  getAudioTracks() { return this.#tracks.filter(t => t.kind === 'audio') }
  getVideoTracks() { return this.#tracks.filter(t => t.kind === 'video') }
  addTrack(t) {
    if (!this.#tracks.includes(t)) {
      this.#tracks.push(t)
      this.#dispatchTrackEvent('addtrack', t)
    }
  }
  removeTrack(t) {
    let i = this.#tracks.indexOf(t)
    if (i >= 0) {
      this.#tracks.splice(i, 1)
      this.#dispatchTrackEvent('removetrack', t)
    }
  }
}
