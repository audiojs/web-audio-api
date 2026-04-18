// Step sequencer: schedule notes precisely using currentTime.
// Run: node examples/sequencer.js
// Run: node examples/sequencer.js bpm=140 -d 10s
// Keys: q quit

import { AudioContext } from 'web-audio-api'
import { args, sec, keys, clearLine } from './_util.js'

let { $ } = args()
let bpm = +$('bpm', 140)
const steps = 16
let stepDuration = 60 / bpm / 4
let dur = sec($('dur', steps * stepDuration))

const ctx = new AudioContext()
await ctx.resume()

const notes = [
  440,  0,    523,  0,    587,  0,    659,  0,
  587,  523,  440,  0,    330,  0,    440,  0,
]

let t0 = ctx.currentTime
let nLoops = Math.ceil(dur / (steps * stepDuration))
for (let loop = 0; loop < nLoops; loop++) {
  for (let step = 0; step < steps; step++) {
    let freq = notes[step]
    if (!freq) continue
    let when = t0 + (loop * steps + step) * stepDuration
    if (when > t0 + dur) break
    let osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.value = freq
    let env = ctx.createGain()
    env.gain.setValueAtTime(0, when)
    env.gain.linearRampToValueAtTime(0.3, when + 0.005)
    env.gain.exponentialRampToValueAtTime(0.01, when + stepDuration * 0.9)
    osc.connect(env).connect(ctx.destination)
    osc.start(when); osc.stop(when + stepDuration)
  }
}

keys({}, () => { clearLine(); ctx.close() }, ctx)
console.log(`Sequencer: ${bpm} BPM, ${steps}-step pattern (${dur}s)  space pause · q quit`)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, dur * 1000 + 200)
