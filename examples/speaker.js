// Hello world — play a 440Hz tone for 2 seconds.
// Run: node examples/speaker.js

import { AudioContext } from 'web-audio-api'

const ctx = new AudioContext()
await ctx.resume()

const osc = ctx.createOscillator()
osc.frequency.value = 440
osc.connect(ctx.destination)
osc.start()

setTimeout(() => ctx.close(), 2000)
