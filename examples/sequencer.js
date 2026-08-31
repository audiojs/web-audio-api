// Step sequencer: schedule notes precisely using currentTime.
// Run: node examples/sequencer.js
// Run: node examples/sequencer.js bpm=140 -d 10s
// Keys: q quit

import { AudioContext } from 'web-audio-api'
import { build } from './graphs/sequencer.js'
import { args, sec, keys, clearLine, help } from './utils.js'

help({
  description: 'schedule a precise 16-step note sequence',
  usage: ['', 'bpm=140 dur=10s'],
  options: [
    ['bpm=<number>', 'tempo (default: 140)'],
    ['-d, --duration <time>', 'run time; defaults to one 16-step loop'],
  ],
  controls: [['Space', 'pause/resume'], ['Q / Esc', 'quit']],
})

let { $ } = args()
let bpm = +$('bpm', 140)
const steps = 16
let stepDuration = 60 / bpm / 4
let dur = sec($('dur', steps * stepDuration))

const ctx = new AudioContext()
await ctx.resume()

build(ctx, { bpm, duration: dur })

keys({}, () => { clearLine(); ctx.close() }, ctx)
console.log(`Sequencer: ${bpm} BPM, ${steps}-step pattern (${dur}s)  space pause · q quit`)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, dur * 1000 + 200)
