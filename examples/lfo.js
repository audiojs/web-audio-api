// LFO tremolo: sine carrier modulated by a low-frequency oscillator.
// Run: node examples/lfo.js

import { AudioContext } from 'web-audio-api'

const duration = 3
const ctx = new AudioContext()
await ctx.resume()

// Carrier: 440Hz sine
let carrier = ctx.createOscillator()
carrier.frequency.value = 440

// LFO: 5Hz square wave modulating gain
let lfo = ctx.createOscillator()
lfo.type = 'square'
lfo.frequency.value = 5

// Scale LFO output to [0, 1] range: offset 0.5 + lfo * 0.5
let lfoGain = ctx.createGain()
lfoGain.gain.value = 0.5

let offset = ctx.createConstantSource()
offset.offset.value = 0.5

let mixer = ctx.createGain()
mixer.gain.value = 0 // controlled by LFO + offset

carrier.connect(mixer).connect(ctx.destination)
lfo.connect(lfoGain).connect(mixer.gain)
offset.connect(mixer.gain)

carrier.start()
lfo.start()
offset.start()

setTimeout(() => ctx.close(), duration * 1000)
