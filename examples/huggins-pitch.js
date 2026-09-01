// Huggins pitch — identical noise in both ears, one phase-shifted, produces a pitch in neither channel.
// Run: node examples/huggins-pitch.js 600 20s
// Run: node examples/huggins-pitch.js freq=600 -d 20s
// Keys: q quit

import { AudioContext } from 'web-audio-api'
import { init } from './graphs/huggins-pitch.js'
import { args, num, sec, keys, clearLine, help } from './utils.js'

help({
  description: 'hear a pitch that exists in neither noise channel alone',
  usage: ['', '[frequency] [duration]', 'freq=600 dur=20s'],
  options: [
    ['freq=<hz>', 'target frequency (default: 600)'],
    ['-d, --duration <time>', 'run time with optional s/m/h suffix (default: 20s)'],
  ],
  controls: [['Space', 'pause/resume'], ['Q / Esc', 'quit']],
  notes: ['Headphones are required; the effect is subtle.'],
})

let { pos, $ } = args()
let freq = num(pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t)) || $('freq', 600))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '20'))

let ctx = new AudioContext()
await ctx.resume()

init(ctx, { frequency: freq, duration: dur, gain: 0.22 })

keys({}, () => { clearLine(); ctx.close() }, ctx)
console.log(`Huggins pitch: ${freq}Hz (${dur}s)  space pause · q quit`)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, dur * 1000 + 200)
