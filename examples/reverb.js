// Convolver reverb — convolve a plucked string through a seeded exponential-decay impulse response.
// Run: node examples/reverb.js 2 0.35 3s
// Run: node examples/reverb.js decay=2 wet=0.35 -d 3s
// Keys: q quit

import { AudioContext } from 'web-audio-api'
import { init } from './graphs/reverb.js'
import { args, sec, keys, clearLine, help } from './utils.js'

help({
  description: 'convolve a plucked string through a seeded impulse response',
  usage: ['', '[decay] [wet] [duration]', 'decay=2 wet=0.35 dur=3s'],
  options: [
    ['decay=<s>', 'impulse response decay time (default: 2)'],
    ['wet=<0..1>', 'wet/dry mix (default: 0.35)'],
    ['-d, --duration <time>', 'run time with optional s/m/h suffix (default: 3s)'],
  ],
  controls: [['Space', 'pause/resume'], ['Q / Esc', 'quit']],
})

let { pos, $ } = args()
let nums = pos.filter(t => /^\d/.test(t) && !/[smh]$/.test(t))
let decay = +(nums[0] || $('decay', 2))
let wet = +(nums[1] || $('wet', 0.35))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '3'))

let ctx = new AudioContext()
await ctx.resume()

init(ctx, { decay, wet, duration: dur, gain: 0.5 })

keys({}, () => { clearLine(); ctx.close() }, ctx)
console.log(`Reverb: decay ${decay}s, wet ${wet} (${dur}s)  space pause · q quit`)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, dur * 1000 + decay * 1000 + 300)
