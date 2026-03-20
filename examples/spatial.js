// Spatial audio: source pans from left to right.
// Run: node examples/spatial.js

import { AudioContext } from 'web-audio-api'

const duration = 3
const ctx = new AudioContext()
await ctx.resume()

let osc = ctx.createOscillator()
osc.frequency.value = 440

let panner = ctx.createPanner()
panner.panningModel = 'equalpower'
panner.distanceModel = 'inverse'

// Move source in an arc in front of the listener (not through the head).
// Z = -2 keeps it 2 units ahead, so azimuth transitions smoothly.
let t = ctx.currentTime
panner.positionX.setValueAtTime(-10, t)
panner.positionX.linearRampToValueAtTime(10, t + duration)
panner.positionY.value = 0
panner.positionZ.value = -2

let master = ctx.createGain()

osc.connect(panner).connect(master).connect(ctx.destination)
osc.start()

let end = t + duration
master.gain.setValueAtTime(1, end - 0.05)
master.gain.linearRampToValueAtTime(0, end)
setTimeout(() => ctx.close(), duration * 1000)
