// Karplus–Strong: a click circulating through a damped delay line becomes a plucked string.
// Run: node hero.js
// The homepage runs this same file in the browser, records the graph it connects, and renders its output.
import { AudioContext } from 'web-audio-api'

const ctx = new AudioContext()
await ctx.resume()

const pluck = ctx.createBufferSource()
pluck.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
pluck.buffer.getChannelData(0)[0] = 1
const string = ctx.createDelay()
string.delayTime.value = 1 / 220
const damping = ctx.createBiquadFilter()
damping.frequency.value = 4000
damping.Q.value = -3 // dB: no resonance, the loop only decays
const feedback = ctx.createGain()
feedback.gain.value = 0.995
pluck.connect(string)
string.connect(damping).connect(feedback).connect(string)
string.connect(ctx.destination)
pluck.start()
setTimeout(() => ctx.close(), 6000)
