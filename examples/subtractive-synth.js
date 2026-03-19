// Subtractive synthesizer: sawtooth → lowpass filter sweep → ADSR envelope.
// Run: node examples/subtractive-synth.js

import { AudioContext } from 'web-audio-api'

const duration = 2
const ctx = new AudioContext()
await ctx.resume()

// Sawtooth oscillator — harmonically rich source
let osc = ctx.createOscillator()
osc.type = 'sawtooth'
osc.frequency.value = 220 // A3

// Lowpass filter with frequency sweep (filter opens then closes)
let filter = ctx.createBiquadFilter()
filter.type = 'lowpass'
filter.Q.value = 8
let t = ctx.currentTime
filter.frequency.setValueAtTime(200, t)
filter.frequency.linearRampToValueAtTime(4000, t + 0.3)       // open
filter.frequency.exponentialRampToValueAtTime(200, t + 1.5)    // close

// ADSR envelope
let env = ctx.createGain()
env.gain.setValueAtTime(0, t)
env.gain.linearRampToValueAtTime(1, t + 0.01)             // attack: 10ms
env.gain.linearRampToValueAtTime(0.7, t + 0.11)           // decay → sustain: 0.7
env.gain.setValueAtTime(0.7, t + duration - 0.3)
env.gain.linearRampToValueAtTime(0, t + duration)          // release: 300ms

osc.connect(filter).connect(env).connect(ctx.destination)
osc.start()

setTimeout(() => ctx.close(), duration * 1000)
