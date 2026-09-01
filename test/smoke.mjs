// Cross-engine smoke: render a sine offline and assert its shape.
// Expected values follow the Web Audio spec (OscillatorNode sine, amplitude 1):
// 441 Hz at 44100 Hz over 4410 samples = 44.1 cycles, peak near 1,
// two zero crossings per cycle = ~88 sign changes.
import { OfflineAudioContext } from '../index.js'

let ctx = new OfflineAudioContext(1, 4410, 44100)
let osc = ctx.createOscillator()
osc.frequency.value = 441
osc.connect(ctx.destination)
osc.start()

let buffer = await ctx.startRendering()
let data = buffer.getChannelData(0)

let peak = 0, crossings = 0
for (let i = 0; i < data.length; i++) {
  let value = Math.abs(data[i])
  if (value > peak) peak = value
  if (i && (data[i] >= 0) !== (data[i - 1] >= 0)) crossings++
}

if (!(peak > 0.99 && peak <= 1)) throw new Error(`sine peak out of range: ${peak}`)
if (!(crossings >= 86 && crossings <= 90)) throw new Error(`zero crossings out of range: ${crossings}`)
console.log(`smoke ok: peak ${peak.toFixed(4)}, ${crossings} zero crossings`)
