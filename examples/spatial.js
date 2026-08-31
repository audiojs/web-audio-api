// Spatial audio: source pans from left to right.
// Run: node examples/spatial.js
// Run: node examples/spatial.js -d 5s
// Keys: q quit

import { AudioContext } from 'web-audio-api'
import { build as buildSpatial } from './graphs/spatial.js'
import { args, sec, keys, clearLine, help } from './utils.js'

help({
  description: 'move a tone from left to right through 3D space',
  usage: ['', '-d 5s'],
  options: [['-d, --duration <time>', 'pan time with optional s/m/h suffix (default: 3s)']],
  controls: [['Space', 'pause/resume'], ['Q / Esc', 'quit']],
})

let { $ } = args()
let duration = sec($('dur', '3'))

const ctx = new AudioContext()
await ctx.resume()

buildSpatial(ctx, { frequency: 440, duration, gain: 1 })

keys({}, () => { clearLine(); ctx.close() }, ctx)
console.log(`Spatial pan (${duration}s)  space pause · q quit`)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, duration * 1000)
