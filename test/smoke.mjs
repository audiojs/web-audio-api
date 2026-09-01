// Cross-engine smoke: render a sine offline and assert its shape.
// Expected values follow the Web Audio spec (OscillatorNode sine, amplitude 1):
// 441 Hz at 44100 Hz over 4410 samples, peak near 1.
import { OfflineAudioContext } from '../index.js'
import { assertFrequency, assertPeak, assertNoDcOffset } from '@audio/assert'

let ctx = new OfflineAudioContext(1, 4410, 44100)
let osc = ctx.createOscillator()
osc.frequency.value = 441
osc.connect(ctx.destination)
osc.start()

let buffer = await ctx.startRendering()

let frequency = assertFrequency(buffer, ctx.sampleRate, 441)
assertPeak(buffer, 1, 0.01)
assertNoDcOffset(buffer)
console.log(`smoke ok: ${frequency.toFixed(2)} Hz, full-scale sine`)
