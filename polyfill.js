// Web Audio API globals for Node: `import 'web-audio-api/polyfill'`
// Also exposes `navigator.mediaDevices.getUserMedia()` backed by the optional
// peer dep `audio-mic` so browser mic code runs verbatim.
import * as waa from './index.js'

for (let [name, value] of Object.entries(waa))
  if (typeof value === 'function' && !(name in globalThis)) globalThis[name] = value

// Tone.js / standardized-audio-context checks `instanceof window.AudioParam`
if (typeof window === 'undefined') globalThis.window = globalThis

globalThis.MediaStreamTrack ??= waa.MediaStreamTrack
globalThis.MediaStream ??= waa.MediaStream
globalThis.CustomMediaStreamTrack ??= waa.CustomMediaStreamTrack

globalThis.navigator ??= {}
globalThis.navigator.mediaDevices ??= {}

// --- navigator.mediaDevices.getUserMedia ---------------------------------
// Backed by the optional 'audio-mic' peer dep.  Install: npm install audio-mic

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
  if (![8, 16, 32].includes(opts.bitDepth)) throw Object.assign(new Error(
    'getUserMedia supports 8, 16, or 32-bit integer PCM samples in Node'),
    { name: 'NotSupportedError' })

  let read = mic(opts)
  let track = new waa.CustomMediaStreamTrack({
    kind: 'audio', label: 'Default audio input',
    settings: { sampleRate: opts.sampleRate, channelCount: opts.channels, sampleSize: opts.bitDepth }
  })
  let stream = new waa.MediaStream([track])

  let pump = () => read((err, chunk) => {
    if (track.readyState === 'ended' || err || !chunk) return
    track.pushData(chunk, { channels: opts.channels, bitDepth: opts.bitDepth })
    pump()
  })
  pump()

  let origStop = track.stop.bind(track)
  track.stop = () => {
    // Best-effort mic close — errors here (e.g. already closed) are harmless.
    try { read(null); read.close?.() } catch {}
    origStop()
  }
  return stream
}

const legacyGetUserMedia = typeof globalThis.navigator.getUserMedia === 'function'
  ? globalThis.navigator.getUserMedia.bind(globalThis.navigator)
  : undefined

globalThis.navigator.mediaDevices.getUserMedia ??=
  typeof legacyGetUserMedia === 'function'
    ? (constraints) => new Promise((resolve, reject) => legacyGetUserMedia(constraints, resolve, reject))
    : getUserMedia

globalThis.navigator.getUserMedia ??= function (constraints, successCallback, errorCallback) {
  globalThis.navigator.mediaDevices.getUserMedia(constraints).then(
    (stream) => { if (typeof successCallback === 'function') successCallback(stream) },
    (error) => { if (typeof errorCallback === 'function') errorCallback(error) }
  )
}
