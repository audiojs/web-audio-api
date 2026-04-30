// Web Audio API globals for Node: `import 'web-audio-api/polyfill'`
import * as waa from './index.js'

for (let [name, value] of Object.entries(waa))
  if (typeof value === 'function' && !(name in globalThis)) globalThis[name] = value

// Tone.js / standardized-audio-context checks `instanceof window.AudioParam`
if (typeof window === 'undefined') globalThis.window = globalThis

globalThis.MediaStreamTrack ??= waa.MediaStreamTrack
globalThis.MediaStream ??= waa.MediaStream
globalThis.CustomMediaStreamTrack ??= waa.CustomMediaStreamTrack
