// Granular synth — scatter jittered grains from a seeded source buffer into a texture cloud.
// Run: node examples/granular.js 0.08 15 4 10s
// Run: node examples/granular.js size=0.08 density=15 spread=4 -d 10s
// Keys: q quit

import { AudioContext } from 'web-audio-api'
import { init } from './graphs/granular.js'
import { args, sec, keys, clearLine, help } from './utils.js'

help({
  description: 'scatter jittered grains from a seeded source buffer',
  usage: ['', '[size] [density] [spread] [duration]', 'size=0.08 density=15 spread=4 dur=10s'],
  options: [
    ['size=<s>', 'grain length (default: 0.08)'],
    ['density=<hz>', 'grains per second (default: 15)'],
    ['spread=<semitones>', 'random pitch jitter range (default: 4)'],
    ['-d, --duration <time>', 'run time with optional s/m/h suffix (default: 10s)'],
  ],
  controls: [['Space', 'pause/resume'], ['Q / Esc', 'quit']],
})

let { pos, $ } = args()
let nums = pos.filter(t => /^\d/.test(t) && !/[smh]$/.test(t))
let size = +(nums[0] || $('size', 0.08))
let density = +(nums[1] || $('density', 15))
let spread = +(nums[2] || $('spread', 4))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '10'))

let ctx = new AudioContext()
await ctx.resume()

init(ctx, { size, density, spread, duration: dur, gain: 0.35 })

keys({}, () => { clearLine(); ctx.close() }, ctx)
console.log(`Granular: ${size}s grains, ${density}/s, ±${spread}st (${dur}s)  space pause · q quit`)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, dur * 1000 + 200)
