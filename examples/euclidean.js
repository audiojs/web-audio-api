// Euclidean rhythms — Bjorklund patterns drive 2-3 percussion voices in interlocking cycles.
// Run: node examples/euclidean.js 120 16 3,5,7 20s
// Run: node examples/euclidean.js tempo=120 steps=16 pulses=3,5,7 -d 20s
// Keys: q quit

import { AudioContext } from 'web-audio-api'
import { init } from './graphs/euclidean.js'
import { args, sec, keys, clearLine, help } from './utils.js'

help({
  description: 'drive percussion voices from Bjorklund Euclidean rhythms',
  usage: ['', '[tempo] [steps] [pulses] [duration]', 'tempo=120 steps=16 pulses=3,5,7 dur=20s'],
  options: [
    ['tempo=<bpm>', 'step tempo (default: 120)'],
    ['steps=<n>', 'steps per cycle (default: 16)'],
    ['pulses=<n,n,n>', 'pulses per voice, comma-separated (default: 3,5,7)'],
    ['-d, --duration <time>', 'run time with optional s/m/h suffix (default: 20s)'],
  ],
  controls: [['Space', 'pause/resume'], ['Q / Esc', 'quit']],
})

let { pos, $ } = args()
let tempo = +(pos.find(t => /^\d+$/.test(t)) || $('tempo', 120))
let steps = +(pos.filter(t => /^\d+$/.test(t))[1] || $('steps', 16))
let pulses = pos.find(t => /^\d+(,\d+){0,2}$/.test(t) && t.includes(',')) || $('pulses', '3,5,7')
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '20'))

let ctx = new AudioContext()
await ctx.resume()

init(ctx, { tempo, steps, pulses, duration: dur })

keys({}, () => { clearLine(); ctx.close() }, ctx)
console.log(`Euclidean: ${tempo}bpm, ${steps} steps, pulses ${pulses} (${dur}s)  space pause · q quit`)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, dur * 1000 + 200)
