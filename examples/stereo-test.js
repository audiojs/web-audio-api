// Stereo test — left, right, center channel identification.
// Run: node examples/stereo-test.js 1k 1s
// Run: node examples/stereo-test.js freq=500 dur=2s

import { AudioContext } from 'web-audio-api'
import { args, num, sec, keys, clearLine } from './_util.js'

let { pos, $ } = args()
let f = num(pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t) || /^[A-G][#b]?\d$/i.test(t)) || $('freq', 1000))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '1'))

let ctx = new AudioContext()
await ctx.resume()

let tests = [['Left', -1], ['Right', 1], ['Center', 0]]
let gap = 0.3

let t = ctx.currentTime
for (let [name, pan] of tests) {
  console.log(name)
  let osc = ctx.createOscillator()
  osc.frequency.value = f
  let panner = ctx.createStereoPanner()
  panner.pan.value = pan

  let env = ctx.createGain()
  env.gain.setValueAtTime(0, t)
  env.gain.linearRampToValueAtTime(0.5, t + 0.02)
  env.gain.setValueAtTime(0.5, t + dur - 0.05)
  env.gain.linearRampToValueAtTime(0, t + dur)

  osc.connect(panner).connect(env).connect(ctx.destination)
  osc.start(t); osc.stop(t + dur + 0.01)
  t += dur + gap
}

keys({}, () => { clearLine(); ctx.close() }, ctx)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, tests.length * (dur + gap) * 1000)
