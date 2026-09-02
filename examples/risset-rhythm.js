// Risset rhythm — infinitely accelerating or decelerating beat.
// The rhythmic analog of the Shepard tone.
// Run: node examples/risset-rhythm.js up 120 20s
// Run: node examples/risset-rhythm.js dir=down bpm=90 -d 30s sound=wood
// Run: node examples/risset-rhythm.js sample=kick.wav
// Keys: q quit

import { readFileSync } from 'node:fs'
import { AudioContext } from 'web-audio-api'
import { init } from './graphs/risset-rhythm.js'
import { createInstrument } from './graphs/metronome.js'
import { args, sec, keys, clearLine, help } from './utils.js'

help({
  description: 'play an endlessly accelerating or decelerating rhythm illusion',
  usage: ['', '[up|down] [bpm] [duration]', 'dir=down bpm=90 dur=30s sound=wood', 'sample=kick.wav'],
  options: [
    ['dir=<up|down>', 'movement direction (default: up)'],
    ['bpm=<number>', 'center tempo (default: 120)'],
    ['-d, --duration <time>', 'run time with optional s/m/h suffix (default: 20s)'],
    ['sound=<preset>', 'click (default) or a metronome preset: classic, wood, bell, beep, signal, karatala'],
    ['sample=<file>', 'use an audio file as the click sound instead of a preset'],
  ],
  controls: [['Space', 'pause/resume'], ['Q / Esc', 'quit']],
})

let { pos, $ } = args()
let dir = pos.find(t => /^(up|down)$/i.test(t)) || $('dir', 'up')
let bpm = +(pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t)) || $('bpm', 120))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '20'))
let sound = String($('sound', 'click')).toLowerCase()
let sampleFile = $('sample')

let ctx = new AudioContext()
await ctx.resume()
// The metronome's instrument collection plays the beats when a preset or sample is asked for;
// the graph keeps its own click otherwise. Decoding happens here so the graph stays atomic.
let sample = sampleFile ? await ctx.decodeAudioData(readFileSync(sampleFile)) : null
let hit = sound !== 'click' || sample ? createInstrument(ctx, { sound, sample }).hit : null
init(ctx, { direction: dir, bpm, duration: dur, hit })

keys({}, () => { clearLine(); ctx.close() }, ctx)
console.log(`Risset rhythm: ${dir}, ~${bpm} BPM center, ${sample ? sampleFile : sound} (${dur}s)  space pause · q quit`)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, dur * 1000 + 500)
