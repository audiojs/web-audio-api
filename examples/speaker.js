// Hello world — play a 440Hz tone for 2 seconds.
// Run: node examples/speaker.js

import { AudioContext } from 'web-audio-api'

const duration = 2
const ctx = new AudioContext()
await ctx.resume()

const osc = ctx.createOscillator()
osc.frequency.value = 440

const master = ctx.createGain()
osc.connect(master).connect(ctx.destination)
osc.start()

// Fade out before closing to avoid click
let t = ctx.currentTime + duration
master.gain.setValueAtTime(1, t - 0.05)
master.gain.linearRampToValueAtTime(0, t)
setTimeout(() => ctx.close(), duration * 1000)
