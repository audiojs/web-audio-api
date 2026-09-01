// Scale illusion — Deutsch: interleaved ascending/descending scales swap ears; listeners regroup by pitch.
// Run: node examples/scale-illusion.js 200 261.63 8s
// Run: node examples/scale-illusion.js tempo=200 root=C4 -d 8s
// Keys: q quit

import { AudioContext } from 'web-audio-api'
import { init } from './graphs/scale-illusion.js'
import { args, num, sec, keys, clearLine, help } from './utils.js'

help({
  description: 'interleave an ascending and descending scale between ears (Deutsch scale illusion)',
  usage: ['', '[tempo] [root] [duration]', 'tempo=200 root=C4 dur=8s'],
  options: [
    ['tempo=<bpm>', 'note tempo (default: 200)'],
    ['root=<hz|note>', 'root frequency (default: 261.63)'],
    ['-d, --duration <time>', 'run time with optional s/m/h suffix (default: 8s)'],
  ],
  controls: [['Space', 'pause/resume'], ['Q / Esc', 'quit']],
  notes: ['Headphones are required: each ear must receive its own independent line.'],
})

let { pos, $ } = args()
let tempo = +(pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t)) || $('tempo', 200))
let root = num(pos.find(t => /^[A-G][#b]?\d$/i.test(t)) || $('root', 261.63))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '8'))

let ctx = new AudioContext()
await ctx.resume()

init(ctx, { tempo, root, duration: dur, gain: 0.15 })

keys({}, () => { clearLine(); ctx.close() }, ctx)
console.log(`Scale illusion: ${tempo}bpm from ${root}Hz (${dur}s)  space pause · q quit`)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, dur * 1000 + 200)
