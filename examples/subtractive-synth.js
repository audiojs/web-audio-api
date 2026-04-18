// Subtractive synthesizer: sawtooth → lowpass filter sweep → ADSR envelope.
// Run: node examples/subtractive-synth.js
// Run: node examples/subtractive-synth.js -d 5s
// Keys: space pause · r retrigger · q quit

import { AudioContext } from 'web-audio-api'
import { args, sec, keys, clearLine } from './_util.js'

let { $ } = args()
let dur = sec($('dur', '2'))

const ctx = new AudioContext()
await ctx.resume()

let master = ctx.createGain()
master.connect(ctx.destination)

let pluck = () => {
  let osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.value = 220
  let filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.Q.value = 8
  let t = ctx.currentTime
  filter.frequency.setValueAtTime(200, t)
  filter.frequency.linearRampToValueAtTime(4000, t + 0.3)
  filter.frequency.exponentialRampToValueAtTime(200, t + 1.5)
  let env = ctx.createGain()
  env.gain.setValueAtTime(0, t)
  env.gain.linearRampToValueAtTime(1, t + 0.01)
  env.gain.linearRampToValueAtTime(0.7, t + 0.11)
  env.gain.setValueAtTime(0.7, t + dur - 0.3)
  env.gain.linearRampToValueAtTime(0, t + dur)
  osc.connect(filter).connect(env).connect(master)
  osc.start(t); osc.stop(t + dur + 0.01)
}
pluck()

keys({ r: pluck }, () => { clearLine(); ctx.close() }, ctx)
console.log(`Subtractive synth (${dur}s)  space pause · r retrigger · q quit`)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, dur * 1000 + 200)
