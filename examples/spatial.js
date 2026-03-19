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

let t = ctx.currentTime
panner.positionX.setValueAtTime(-10, t)
panner.positionX.linearRampToValueAtTime(10, t + duration)
panner.positionY.value = 0
panner.positionZ.value = 0

osc.connect(panner).connect(ctx.destination)
osc.start()

setTimeout(() => ctx.close(), duration * 1000)
