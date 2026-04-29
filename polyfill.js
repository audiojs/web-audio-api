// Web Audio API globals for Node: `import 'web-audio-api/polyfill'`
// Also exposes `navigator.mediaDevices.getUserMedia()` + MediaStream/Track so
// browser mic code runs verbatim. Requires optional peer dep `audio-mic`.
import * as waa from './index.js'
import createMediaStream from './src/createMediaStream.js'

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
  let read = mic(opts)
  let track = new MediaStreamTrack('audio', 'Default audio input',
    { sampleRate: opts.sampleRate, channelCount: opts.channels, sampleSize: opts.bitDepth })
  let stream = new MediaStream([track])
  stream._buffers = createMediaStream(read, opts)._buffers  // share buffer array

  let origStop = track.stop.bind(track)
  track.stop = () => { try { read(null); read.close?.() } catch {} origStop() }
  return stream
}

globalThis.navigator ??= {}
globalThis.navigator.mediaDevices ??= {}
globalThis.navigator.mediaDevices.getUserMedia ??= getUserMedia
