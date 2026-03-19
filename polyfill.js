// Polyfill: register Web Audio API globals if not already present.
// Usage: import 'web-audio-api/polyfill'
import * as waa from './index.js'

for (let [name, value] of Object.entries(waa)) {
  if (typeof value === 'function' && !(name in globalThis))
    globalThis[name] = value
}
