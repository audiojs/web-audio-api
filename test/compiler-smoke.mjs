// No test-library or device dependency in the compiled entry.
import { OfflineAudioContext } from '../index.js'

export async function render() {
  const ctx = new OfflineAudioContext(1, 4410, 44100)
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.frequency.value = 441
  gain.gain.value = 0.5
  osc.connect(gain).connect(ctx.destination)
  osc.start()
  const audio = await ctx.startRendering()
  const samples = audio.getChannelData(0)
  let peak = 0, energy = 0, crossings = 0
  for (let i = 0; i < samples.length; i++) {
    if (!Number.isFinite(samples[i])) throw Error('Non-finite render')
    peak = Math.max(peak, Math.abs(samples[i]))
    energy += samples[i] * samples[i]
    if (i > 0 && samples[i - 1] <= 0 && samples[i] > 0) crossings++
  }
  if (samples.length !== 4410 || peak < 0.49 || peak > 0.51 || energy < 500 || energy > 600 || crossings < 44 || crossings > 45)
    throw Error('Render does not match a 441 Hz, half-scale sine')
  return energy
}
