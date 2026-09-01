// Additive synthesis — build waveforms from individual harmonics.
// Run: node examples/additive.js square 220 16 3s
// Run: node examples/additive.js wave=saw freq=1k n=32 -d 5s
// Keys: q quit

import { AudioContext } from 'web-audio-api'
import { init } from './graphs/additive.js'
import { args, num, sec, keys, clearLine, help } from './utils.js'

help({
  description: 'build a waveform from individual harmonics',
  usage: ['', '[square|saw|triangle] [frequency] [harmonics] [duration]', 'wave=saw freq=1k n=32 dur=5s'],
  options: [
    ['wave=<type>', 'square (default), saw, or triangle'],
    ['freq=<hz|note>', 'fundamental frequency (default: 220)'],
    ['n=<number>', 'number of harmonics (default: 16)'],
    ['-d, --duration <time>', 'run time with optional s/m/h suffix (default: 3s)'],
  ],
  controls: [['Space', 'pause/resume'], ['Q / Esc', 'quit']],
})

let { pos, $ } = args()
let wave = pos.find(t => /^[a-z]/i.test(t) && !/^[A-G][#b]?\d$/i.test(t)) || $('wave', 'square')
let nums = pos.filter(t => /^\d/.test(t) && !/[smh]$/.test(t) || /^[A-G][#b]?\d$/i.test(t))
let f = num(nums[0] || $('freq', 220))
let n = +(nums[1] || $('n', 16))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '3'))

let ctx = new AudioContext()
await ctx.resume()

init(ctx, { waveform: wave, frequency: f, harmonics: n, duration: dur })

keys({}, () => { clearLine(); ctx.close() }, ctx)
console.log(`Additive ${wave}: ${f}Hz, ${n} harmonics (${dur}s)  space pause · q quit`)

setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, dur * 1000)
