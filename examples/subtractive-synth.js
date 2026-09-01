// Subtractive synthesizer: sawtooth → lowpass filter sweep → ADSR envelope.
// Run: node examples/subtractive-synth.js
// Run: node examples/subtractive-synth.js freq=110 cutoff=5000 q=12 -d 5s
// Keys: space pause · r retrigger · q quit

import { AudioContext } from 'web-audio-api'
import { init } from './graphs/subtractive-synth.js'
import { args, num, sec, keys, clearLine, help } from './utils.js'

help({
  description: 'demonstrate sawtooth, filter-envelope, and ADSR synthesis',
  usage: ['', 'freq=110 cutoff=5000 q=12 -d 5s'],
  options: [
    ['freq=<hz|note>', 'oscillator frequency (default: 220)'],
    ['cutoff=<hz>', 'filter sweep peak frequency (default: 3600)'],
    ['q=<number>', 'filter resonance (default: 8)'],
    ['-d, --duration <time>', 'note length with optional s/m/h suffix (default: 2s)'],
  ],
  controls: [['Space', 'pause/resume'], ['R', 'retrigger the note'], ['Q / Esc', 'quit']],
})

let { $ } = args()
let freq = num($('freq', 220))
let cutoff = num($('cutoff', 3600))
let q = num($('q', 8))
let dur = sec($('dur', '2'))

const ctx = new AudioContext()
await ctx.resume()

let pluck = () => init(ctx, { frequency: freq, cutoff, resonance: q, duration: dur })
pluck()

keys({ r: pluck }, () => { clearLine(); ctx.close() }, ctx)
console.log(`Subtractive synth (${dur}s)  space pause · r retrigger · q quit`)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, dur * 1000 + 200)
