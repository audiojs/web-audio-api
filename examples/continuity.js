// Continuity illusion — a gapped tone sounds unbroken once louder noise bursts fill the gaps.
// Run: node examples/continuity.js 440 0.6 on 15s
// Run: node examples/continuity.js freq=440 gaprate=0.6 noise=on -d 15s
// Keys: q quit

import { AudioContext } from 'web-audio-api'
import { init } from './graphs/continuity.js'
import { args, num, sec, keys, clearLine, help } from './utils.js'

help({
  description: 'fill gaps in a tone with noise so it sounds continuous',
  usage: ['', '[frequency] [gap-rate] [noise] [duration]', 'freq=440 gaprate=0.6 noise=on dur=15s'],
  options: [
    ['freq=<hz|note>', 'tone frequency (default: 440)'],
    ['gaprate=<hz>', 'gaps per second (default: 0.6)'],
    ['noise=<on|off>', 'fill gaps with masking noise, or leave them silent (default: on)'],
    ['-d, --duration <time>', 'run time with optional s/m/h suffix (default: 15s)'],
  ],
  controls: [['Space', 'pause/resume'], ['Q / Esc', 'quit']],
})

let { pos, $ } = args()
let nums = pos.filter(t => /^\d/.test(t) && !/[smh]$/.test(t) || /^[A-G][#b]?\d$/i.test(t))
let freq = num(nums[0] || $('freq', 440))
let gaprate = +(nums[1] || $('gaprate', 0.6))
let noise = (pos.find(t => /^(on|off)$/i.test(t)) || $('noise', 'on')).toLowerCase()
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '15'))

let ctx = new AudioContext()
await ctx.resume()

init(ctx, { frequency: freq, gaprate, noise, duration: dur, gain: 0.16 })

keys({}, () => { clearLine(); ctx.close() }, ctx)
console.log(`Continuity illusion: ${freq}Hz, ${gaprate} gaps/s, noise ${noise} (${dur}s)  space pause · q quit`)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, dur * 1000 + 200)
