// Frequency sweep with gain envelope — hear 100Hz rise to 4kHz.
// Run: node examples/sweep.js

import { AudioContext } from 'web-audio-api'

const duration = 3
const ctx = new AudioContext()
await ctx.resume()

let osc = ctx.createOscillator()
let t = ctx.currentTime
osc.frequency.setValueAtTime(100, t)
osc.frequency.exponentialRampToValueAtTime(4000, t + duration) // 100Hz → 4kHz

let gain = ctx.createGain()
gain.gain.setValueAtTime(0, t)
gain.gain.linearRampToValueAtTime(1, t + 0.1)             // attack: 100ms
gain.gain.setValueAtTime(1, t + duration - 0.5)
gain.gain.linearRampToValueAtTime(0, t + duration)         // release: 500ms

osc.connect(gain).connect(ctx.destination)
osc.start()

setTimeout(() => ctx.close(), duration * 1000)
