// Octave illusion — Deutsch: antiphase tones swap ears each beat and fuse into one jumping tone.
// Run: node examples/octave-illusion.js 400 800 2 12s
// Run: node examples/octave-illusion.js low=400 high=800 rate=2 -d 12s
// Keys: q quit

import { AudioContext } from 'web-audio-api'
import { init } from './graphs/octave-illusion.js'
import { args, num, sec, keys, clearLine, help } from './utils.js'

help({
  description: 'alternate antiphase tones between ears (Deutsch octave illusion)',
  usage: ['', '[low] [high] [rate] [duration]', 'low=400 high=800 rate=2 dur=12s'],
  options: [
    ['low=<hz|note>', 'lower frequency (default: 400)'],
    ['high=<hz|note>', 'higher frequency (default: 800)'],
    ['rate=<hz>', 'alternation rate (default: 2)'],
    ['-d, --duration <time>', 'run time with optional s/m/h suffix (default: 12s)'],
  ],
  controls: [['Space', 'pause/resume'], ['Q / Esc', 'quit']],
  notes: ['Headphones are required: the illusion depends on true left/right channel separation.'],
})

let { pos, $ } = args()
let nums = pos.filter(t => /^\d/.test(t) && !/[smh]$/.test(t) || /^[A-G][#b]?\d$/i.test(t))
let low = num(nums[0] || $('low', 400))
let high = num(nums[1] || $('high', 800))
let rate = +(nums[2] || $('rate', 2))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '12'))

let ctx = new AudioContext()
await ctx.resume()

init(ctx, { low, high, rate, duration: dur, gain: 0.16 })

keys({}, () => { clearLine(); ctx.close() }, ctx)
console.log(`Octave illusion: ${low}Hz / ${high}Hz swapping ears at ${rate}Hz (${dur}s)  space pause · q quit`)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, dur * 1000 + 200)
