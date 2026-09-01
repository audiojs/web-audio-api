// Zwicker tone — a notch cut into cycling noise leaves a faint after-tone in the silence.
// Run: node examples/zwicker-tone.js 2000 3 2 20s
// Run: node examples/zwicker-tone.js freq=2000 on=3 off=2 -d 20s
// Keys: q quit

import { AudioContext } from 'web-audio-api'
import { init } from './graphs/zwicker-tone.js'
import { args, num, sec, keys, clearLine, help } from './utils.js'

help({
  description: 'notch cycling noise and hear a faint after-tone in the silence',
  usage: ['', '[frequency] [on] [off] [duration]', 'freq=2000 on=3 off=2 dur=20s'],
  options: [
    ['freq=<hz>', 'notch center frequency (default: 2000)'],
    ['on=<s>', 'noise-on duration (default: 3)'],
    ['off=<s>', 'silence duration (default: 2)'],
    ['-d, --duration <time>', 'run time with optional s/m/h suffix (default: 20s)'],
  ],
  controls: [['Space', 'pause/resume'], ['Q / Esc', 'quit']],
  notes: ['Best heard in a quiet room; the after-tone is faint.'],
})

let { pos, $ } = args()
let nums = pos.filter(t => /^\d/.test(t) && !/[smh]$/.test(t))
let freq = num(nums[0] || $('freq', 2000))
let on = +(nums[1] || $('on', 3))
let off = +(nums[2] || $('off', 2))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '20'))

let ctx = new AudioContext()
await ctx.resume()

init(ctx, { frequency: freq, on, off, duration: dur, gain: 0.25 })

keys({}, () => { clearLine(); ctx.close() }, ctx)
console.log(`Zwicker tone: notch ${freq}Hz, ${on}s on / ${off}s off (${dur}s)  space pause · q quit`)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, dur * 1000 + 200)
