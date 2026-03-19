// Pipe audio to system player via stdout.
// Run: node examples/pipe-stdout.js | aplay -f cd
//   or: node examples/pipe-stdout.js | ffplay -f s16le -ar 44100 -ac 2 -

import { AudioContext } from 'web-audio-api'

const ctx = new AudioContext()
await ctx.resume()

const osc = ctx.createOscillator()
osc.frequency.value = 440
osc.connect(ctx.destination)
osc.start()

setTimeout(() => ctx.close(), 2000)
