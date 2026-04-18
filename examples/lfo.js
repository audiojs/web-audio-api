// LFO tremolo: sine carrier modulated by a low-frequency oscillator.
// Run: node examples/lfo.js
// Run: node examples/lfo.js rate=5 depth=0.5 -d 10s
// Keys: ←/→ ±0.5 Hz rate · ↑/↓ ±0.05 depth · w cycle LFO wave · q quit

import { AudioContext } from 'web-audio-api'
import { args, sec, keys, status, clearLine, pausedTag } from './_util.js'

let { $ } = args()
let dur = sec($('dur', '30'))
let rate = +$('rate', 5)
let depth = +$('depth', 0.5)
let waves = ['sine', 'square', 'triangle', 'sawtooth']
let wIdx = waves.indexOf($('wave', 'square')); if (wIdx < 0) wIdx = 1

let ctx = new AudioContext()
await ctx.resume()

let carrier = ctx.createOscillator()
carrier.frequency.value = 440
let lfo = ctx.createOscillator()
lfo.type = waves[wIdx]
lfo.frequency.value = rate
let lfoGain = ctx.createGain()
lfoGain.gain.value = depth
let offset = ctx.createConstantSource()
offset.offset.value = 1 - depth
let mixer = ctx.createGain()
mixer.gain.value = 0
let master = ctx.createGain()
master.gain.value = 0.3
carrier.connect(mixer).connect(master).connect(ctx.destination)
lfo.connect(lfoGain).connect(mixer.gain)
offset.connect(mixer.gain)
carrier.start(); lfo.start(); offset.start()

let apply = () => {
  let t = ctx.currentTime
  lfo.frequency.setTargetAtTime(rate, t, 0.02)
  lfoGain.gain.setTargetAtTime(depth, t, 0.02)
  offset.offset.setTargetAtTime(1 - depth, t, 0.02)
}

let render = status()
let ui = setInterval(() => render(`carrier 440Hz · LFO ${waves[wIdx].padEnd(9)} ${rate.toFixed(2)}Hz · depth ${depth.toFixed(2)} · space pause · ←→ rate · ↑↓ depth · w wave · q quit${pausedTag(ctx)}`), 80)

keys({
  left: () => { rate = Math.max(0.1, rate - 0.5); apply() },
  right: () => { rate += 0.5; apply() },
  up: () => { depth = Math.min(1, depth + 0.05); apply() },
  down: () => { depth = Math.max(0, depth - 0.05); apply() },
  w: () => { wIdx = (wIdx + 1) % waves.length; lfo.type = waves[wIdx] },
}, () => { clearInterval(ui); clearLine(); ctx.close() }, ctx)

let t = ctx.currentTime + dur
master.gain.setValueAtTime(0.3, t - 0.05)
master.gain.linearRampToValueAtTime(0, t)
setTimeout(() => { clearInterval(ui); clearLine(); ctx.close(); process.exit(0) }, dur * 1000)
