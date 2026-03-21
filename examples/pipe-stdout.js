// Pipe audio to system player via stdout.
// Run: node examples/pipe-stdout.js | aplay -f cd
//   or: node examples/pipe-stdout.js | ffplay -f s16le -ar 44100 -ac 2 -

import { AudioContext } from 'web-audio-api'

const duration = 2
const ctx = new AudioContext({ sinkId: process.stdout })
await ctx.resume()

const osc = ctx.createOscillator()
osc.frequency.value = 440

const master = ctx.createGain()
osc.connect(master).connect(ctx.destination)
osc.start()

let t = ctx.currentTime + duration
master.gain.setValueAtTime(1, t - 0.05)
master.gain.linearRampToValueAtTime(0, t)
setTimeout(() => ctx.close(), duration * 1000)
