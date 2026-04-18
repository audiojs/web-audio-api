// Spatial audio: source pans from left to right.
// Run: node examples/spatial.js
// Run: node examples/spatial.js -d 5s
// Keys: q quit

import { AudioContext } from 'web-audio-api'
import { args, sec, keys, clearLine } from './_util.js'

let { $ } = args()
let duration = sec($('dur', '3'))

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
panner.positionZ.value = -2

let master = ctx.createGain()
osc.connect(panner).connect(master).connect(ctx.destination)
osc.start()

let end = t + duration
master.gain.setValueAtTime(1, end - 0.05)
master.gain.linearRampToValueAtTime(0, end)

keys({}, () => { clearLine(); ctx.close() }, ctx)
console.log(`Spatial pan (${duration}s)  space pause · q quit`)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, duration * 1000)
