// Step sequencer: schedule notes precisely using currentTime.
// Run: node examples/sequencer.js

import { AudioContext } from 'web-audio-api'

const bpm = 140
const steps = 16
const stepDuration = 60 / bpm / 4 // 16th notes
const duration = steps * stepDuration
const ctx = new AudioContext()
await ctx.resume()

// A minor pentatonic pattern
const notes = [
  440,  0,    523,  0,    587,  0,    659,  0,
  587,  523,  440,  0,    330,  0,    440,  0,
] // 0 = rest

let t = ctx.currentTime
for (let step = 0; step < steps; step++) {
  let freq = notes[step]
  if (!freq) continue

  let when = t + step * stepDuration

  let osc = ctx.createOscillator()
  osc.type = 'square'
  osc.frequency.value = freq

  let env = ctx.createGain()
  env.gain.setValueAtTime(0, when)
  env.gain.linearRampToValueAtTime(0.3, when + 0.005)
  env.gain.exponentialRampToValueAtTime(0.01, when + stepDuration * 0.9)

  osc.connect(env).connect(ctx.destination)
  osc.start(when)
  osc.stop(when + stepDuration)
}

setTimeout(() => ctx.close(), duration * 1000 + 200)
