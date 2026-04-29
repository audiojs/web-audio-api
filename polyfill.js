// Web Audio API globals for Node: `import 'web-audio-api/polyfill'`
// Also exposes `navigator.mediaDevices.getUserMedia()` + MediaStream/Track so
// browser mic code runs verbatim. Requires optional peer dep `audio-mic`.
import * as waa from './index.js'
import convert from 'pcm-convert'

for (let [name, value] of Object.entries(waa))
  if (typeof value === 'function' && !(name in globalThis)) globalThis[name] = value

// Tone.js / standardized-audio-context checks `instanceof window.AudioParam`
if (typeof window === 'undefined') globalThis.window = globalThis

// --- MediaStream / MediaStreamTrack --------------------------------------
// Minimal spec-shaped classes for `instanceof` + track.stop() in Node.

let nextId = 0
class MediaStreamTrack extends EventTarget {
  kind; label; enabled = true; readyState = 'live'
  id = 'track-' + (++nextId)
  #settings
  constructor(kind = 'audio', label = '', settings = {}) {
    super(); this.kind = kind; this.label = label; this.#settings = settings
  }
  stop() {
    if (this.readyState === 'ended') return
    this.readyState = 'ended'
    this.dispatchEvent(new Event('ended'))
  }
  clone() { return new MediaStreamTrack(this.kind, this.label, this.#settings) }
  getSettings() { return { ...this.#settings } }
}

class MediaStream {
  id = 'stream-' + Math.random().toString(36).slice(2)
  #tracks
  _buffers = []
  constructor(tracks = []) { this.#tracks = [...(tracks instanceof MediaStream ? tracks.getTracks() : tracks)] }
  get active() { return this.#tracks.some(t => t.readyState === 'live') }
  getTracks() { return [...this.#tracks] }
  getAudioTracks() { return this.#tracks.filter(t => t.kind === 'audio') }
  getVideoTracks() { return this.#tracks.filter(t => t.kind === 'video') }
  addTrack(t) { if (!this.#tracks.includes(t)) this.#tracks.push(t) }
  removeTrack(t) { let i = this.#tracks.indexOf(t); if (i >= 0) this.#tracks.splice(i, 1) }
}

globalThis.MediaStreamTrack ??= MediaStreamTrack
globalThis.MediaStream ??= MediaStream

// --- navigator.mediaDevices.getUserMedia ---------------------------------

let pick = v => v == null ? undefined : typeof v === 'number' ? v : (v.ideal ?? v.exact ?? v.min ?? v.max)
let splitPlanar = (data, channels) => {
  if (channels === 1) return data
  let frames = data.length / channels
  return Array.from({ length: channels }, (_, ch) => data.subarray(ch * frames, (ch + 1) * frames))
}

let toFloat32 = (chunk, opts) => {
  if (chunk instanceof Float32Array || Array.isArray(chunk)) return chunk
  if (![8, 16, 32].includes(opts.bitDepth))
    throw new TypeError('getUserMedia PCM conversion supports 8, 16, or 32-bit integer samples')
  let bytes = chunk instanceof ArrayBuffer
    ? chunk
    : chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength)
  let data = convert(bytes, { dtype: `int${opts.bitDepth}`, channels: opts.channels, interleaved: true, endianness: 'le' },
    { dtype: 'float32', channels: opts.channels, interleaved: false })
  return splitPlanar(data, opts.channels)
}

async function getUserMedia(constraints = {}) {
  if (!constraints.audio) throw Object.assign(new Error(
    'getUserMedia: only { audio } is supported in Node'), { name: 'NotSupportedError' })

  let mic
  try { mic = (await import('audio-mic')).default }
  catch { throw Object.assign(new Error(
    "getUserMedia requires 'audio-mic' in Node. Install: npm install audio-mic"),
    { name: 'NotFoundError' }) }

  let c = constraints.audio === true ? {} : constraints.audio
  let opts = { sampleRate: pick(c.sampleRate) ?? 44100, channels: pick(c.channelCount) ?? 1, bitDepth: pick(c.sampleSize) ?? 16 }
  if (![8, 16, 32].includes(opts.bitDepth)) throw Object.assign(new Error(
    'getUserMedia supports 8, 16, or 32-bit integer PCM samples in Node'),
    { name: 'NotSupportedError' })
  let read = mic(opts)
  let track = new MediaStreamTrack('audio', 'Default audio input',
    { sampleRate: opts.sampleRate, channelCount: opts.channels, sampleSize: opts.bitDepth })
  let stream = new MediaStream([track])
  let live = true
  let pump = () => read((err, chunk) => {
    if (!live || err || !chunk) return
    stream._buffers.push(toFloat32(chunk, opts))
    pump()
  })
  pump()

  let origStop = track.stop.bind(track)
  track.stop = () => { live = false; try { read(null); read.close?.() } catch {} origStop() }
  return stream
}

globalThis.navigator ??= {}
globalThis.navigator.mediaDevices ??= {}
globalThis.navigator.mediaDevices.getUserMedia ??= getUserMedia
