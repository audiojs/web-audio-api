// Missing fundamental — hear a pitch that isn't there.
// Only harmonics 2–6 are played; the brain fills in the fundamental.
// Run: node examples/missing-fundamental.js 100 3s
// Run: node examples/missing-fundamental.js freq=80 dur=5s

import { AudioContext } from 'web-audio-api'
import { init } from './graphs/missing-fundamental.js'
import { args, num, sec, keys, clearLine, help } from './utils.js'

help({
  description: 'hear a fundamental frequency that is not being played',
  usage: ['', '[fundamental] [duration]', 'freq=80 dur=5s'],
  options: [
    ['freq=<hz|note>', 'implied fundamental; only harmonics 2–6 are played (default: 100)'],
    ['fund=<on|off>', 'include the fundamental for comparison (default: off)'],
    ['-d, --duration <time>', 'run time with optional s/m/h suffix (default: 3s)'],
  ],
  controls: [['Space', 'pause/resume'], ['Q / Esc', 'quit']],
})

let { pos, $ } = args()
let f = num(pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t) || /^[A-G][#b]?\d$/i.test(t)) || $('freq', 100))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '3'))

let ctx = new AudioContext()
await ctx.resume()

let fundamental = String($('fund', 'off')).toLowerCase() === 'on' ? 'on' : 'off'
init(ctx, { frequency: f, fundamental, duration: dur, gain: 0.15 })

keys({}, () => { clearLine(); ctx.close() }, ctx)
console.log(`Harmonics of ${f}Hz: ${[2, 3, 4, 5, 6].map(h => f * h + 'Hz').join(', ')}`)
console.log(`You hear ${f}Hz — but it's not there.  space pause · q quit`)

setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, dur * 1000)
