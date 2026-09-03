// Generative jazz — a style, a lead, a key, and a new performance every time.
// Run: node examples/jazz.js
// Run: node examples/jazz.js style=ambient lead=flute -d 3m
// Keys: space pause · q quit

import { AudioContext, AudioWorkletNode } from 'web-audio-api'
import { init } from './graphs/jazz.js'
import { args, sec, keys, clearLine, help } from './utils.js'

help({
  description: 'generate a jazz performance in a chosen style',
  usage: ['', 'style=ambient lead=flute -d 3m', 'style=bossa bpm=124'],
  options: [
    ['style=<name>', 'modal (default), ambient, nordic, ballad, bossa, swing, or blues'],
    ['lead=<name>', 'guitar (default), flute, harp, or piano'],
    ['bpm=<number>', 'performance tempo (default: the middle of the style\'s range)'],
    ['-d, --duration <time>', 'target length with optional s/m/h suffix (default: 270s)'],
  ],
  controls: [['Space', 'pause/resume'], ['Q / Esc', 'quit']],
  notes: ['Every performance picks a new key, tempo, and improvisation; pass seed=<number> to repeat one.'],
})

let { $ } = args()
let style = String($('style', 'modal')).toLowerCase()
let lead = String($('lead', 'guitar')).toLowerCase()
let bpm = $('bpm') ? +$('bpm') : null
let seed = $('seed') ? +$('seed') : null
let dur = sec($('dur', '270'))

let ctx = new AudioContext()
await ctx.resume()
let demo = await init(ctx, { style, lead, bpm, seed, duration: dur, AudioWorkletNodeClass: AudioWorkletNode })

keys({}, () => { clearLine(); ctx.close() }, ctx)
console.log(`♪ ${demo.data.style} in ${demo.data.key}, ${demo.data.lead} lead, ${demo.data.bpm} BPM, ${(demo.duration / 60).toFixed(1)} min — space pause · q quit\n` + demo.data.chordLog.join(' '))
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, demo.duration * 1000 + 500)
