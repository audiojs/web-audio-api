// Subtractive synthesizer: sawtooth → lowpass filter sweep → ADSR envelope.
// Run: node examples/subtractive-synth.js
// Run: node examples/subtractive-synth.js -d 5s
// Keys: space pause · r retrigger · q quit

import { AudioContext } from 'web-audio-api'
import { init } from './graphs/subtractive-synth.js'
import { args, sec, keys, clearLine, help } from './utils.js'

help({
  description: 'demonstrate sawtooth, filter-envelope, and ADSR synthesis',
  usage: ['', '-d 5s'],
  options: [['-d, --duration <time>', 'note length with optional s/m/h suffix (default: 2s)']],
  controls: [['Space', 'pause/resume'], ['R', 'retrigger the note'], ['Q / Esc', 'quit']],
})

let { $ } = args()
let dur = sec($('dur', '2'))

const ctx = new AudioContext()
await ctx.resume()

let pluck = () => init(ctx, { duration: dur })
pluck()

keys({ r: pluck }, () => { clearLine(); ctx.close() }, ctx)
console.log(`Subtractive synth (${dur}s)  space pause · r retrigger · q quit`)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, dur * 1000 + 200)
