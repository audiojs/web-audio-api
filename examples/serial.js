// Serial music — twelve-tone technique (Schoenberg / Webern).
// Pointillistic, wide register, sparse — different every run.
// Run: node examples/serial.js 72 30s
// Run: node examples/serial.js tempo=100 dur=1m

import { AudioContext } from 'web-audio-api'
import { init } from './graphs/serial.js'
import { args, sec, keys, clearLine, help } from './utils.js'

help({
  description: 'generate pointillistic music from a random twelve-tone row',
  usage: ['', '[tempo] [duration]', 'tempo=100 dur=1m'],
  options: [
    ['tempo=<bpm>', 'approximate tempo (default: 72)'],
    ['-d, --duration <time>', 'run time with optional s/m/h suffix (default: 30s)'],
  ],
  controls: [['Space', 'pause/resume'], ['Q / Esc', 'quit']],
})

let { pos, $ } = args()
let tempo = +(pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t)) || $('tempo', 72))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '30'))

let ctx = new AudioContext()
await ctx.resume()

let demo = init(ctx, { tempo, duration: dur, seed: Math.random() * 0xffffffff })
let row = demo.data.row

keys({}, () => { clearLine(); ctx.close() }, ctx)
console.log(`12-tone row: [${row.join(' ')}], ~${tempo} BPM (${dur}s)  space pause · q quit`)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, dur * 1000 + 500)
