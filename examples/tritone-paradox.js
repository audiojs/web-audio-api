// Tritone paradox — Deutsch: octave-complex tone pairs a tritone apart, ambiguous up/down judgment.
// Run: node examples/tritone-paradox.js 0 8 1.2
// Run: node examples/tritone-paradox.js root=0 pairs=8 rate=1.2
// Keys: q quit

import { AudioContext } from 'web-audio-api'
import { init } from './graphs/tritone-paradox.js'
import { args, keys, clearLine, help } from './utils.js'

help({
  description: 'play octave-complex tone pairs a tritone apart (Deutsch tritone paradox)',
  usage: ['', '[root] [pairs] [rate]', 'root=0 pairs=8 rate=1.2'],
  options: [
    ['root=<0-11>', 'root pitch class, 0=C .. 11=B (default: 0)'],
    ['pairs=<n>', 'number of tone pairs (default: 8)'],
    ['rate=<hz>', 'tones per second (default: 1.2)'],
  ],
  controls: [['Space', 'pause/resume'], ['Q / Esc', 'quit']],
})

let { pos, $ } = args()
let nums = pos.filter(t => /^\d/.test(t))
let root = +(nums[0] || $('root', 0))
let pairs = +(nums[1] || $('pairs', 8))
let rate = +(nums[2] || $('rate', 1.2))
let dur = pairs * 2 / rate

let ctx = new AudioContext()
await ctx.resume()

init(ctx, { root, pairs, rate, gain: 0.12 })

keys({}, () => { clearLine(); ctx.close() }, ctx)
console.log(`Tritone paradox: root ${root}, ${pairs} pairs at ${rate}Hz (${dur.toFixed(1)}s)  space pause · q quit`)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, dur * 1000 + 300)
