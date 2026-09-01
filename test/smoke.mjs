// Cross-engine smoke: render a sine offline and assert its shape.
// Expected values follow the Web Audio spec (OscillatorNode sine, amplitude 1):
// 441 Hz at 44100 Hz over 4410 samples, peak near 1.
import { OfflineAudioContext } from '../index.js'
import { frequency, peak, dc } from '@audio/assert'

let ctx = new OfflineAudioContext(1, 4410, 44100)
let osc = ctx.createOscillator()
osc.frequency.value = 441
osc.connect(ctx.destination)
osc.start()

let buffer = await ctx.startRendering()

let hz = frequency(buffer, ctx.sampleRate, 441)
peak(buffer, 1, 0.01)
dc(buffer, 0.01)
console.log(`smoke ok: ${hz.toFixed(2)} Hz, full-scale sine`)
