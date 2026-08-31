// Gamelan — Balinese-style interlocking patterns (kotekan).
// Slendro scale, metalophone timbre, colotomic gong structure.
// Run: node examples/gamelan.js 120 20s
// Run: node examples/gamelan.js tempo=140 -d 1m
// Keys: q quit

import { AudioContext } from 'web-audio-api'
import { build } from './graphs/gamelan.js'
import { args, sec, keys, clearLine, help } from './utils.js'

help({
  description: 'play Balinese-style kotekan in a slendro scale',
  usage: ['', '[tempo] [duration]', 'tempo=140 dur=1m'],
  options: [
    ['tempo=<bpm>', 'tempo (default: 120)'],
    ['-d, --duration <time>', 'run time with optional s/m/h suffix (default: 20s)'],
  ],
  controls: [['Space', 'pause/resume'], ['Q / Esc', 'quit']],
})

let { pos, $ } = args()
let tempo = +(pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t)) || $('tempo', 120))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '20'))

let ctx = new AudioContext()
await ctx.resume()

build(ctx, { tempo, duration: dur })

keys({}, () => { clearLine(); ctx.close() }, ctx)
console.log(`Gamelan kotekan: slendro, ${tempo} BPM (${dur}s)  space pause · q quit`)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, dur * 1000 + 500)
