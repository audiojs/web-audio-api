// FM synthesis — DX7-style frequency modulation.
// Run: node examples/fm-synthesis.js 440 2 5 3s
// Run: node examples/fm-synthesis.js carrier=440 ratio=2 index=5 -d 3s
// Keys: ←/→ ±0.5 ratio · ↑/↓ ±1 index · q quit

import { AudioContext } from 'web-audio-api'
import { args, num, sec, keys, status, clearLine, pausedTag } from './_util.js'

let { pos, $ } = args()
let nums = pos.filter(t => /^\d/.test(t) && !/[smh]$/.test(t) || /^[A-G][#b]?\d$/i.test(t))
let carrier = num(nums[0] || $('carrier', 440))
let ratio = +(nums[1] || $('ratio', 2))
let index = +(nums[2] || $('index', 5))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '30'))

let ctx = new AudioContext()
await ctx.resume()

let mod = ctx.createOscillator()
mod.frequency.value = carrier * ratio
let modGain = ctx.createGain()
modGain.gain.value = index * carrier * ratio

let car = ctx.createOscillator()
car.frequency.value = carrier
mod.connect(modGain).connect(car.frequency)

let master = ctx.createGain()
master.gain.value = 0.3
car.connect(master).connect(ctx.destination)
mod.start(); car.start()

let apply = () => {
  let t = ctx.currentTime
  mod.frequency.setTargetAtTime(carrier * ratio, t, 0.02)
  modGain.gain.setTargetAtTime(index * carrier * ratio, t, 0.02)
}

let render = status()
let ui = setInterval(() => render(`FM · carrier ${carrier}Hz · ratio ${ratio.toFixed(1)} · index ${index.toFixed(1)} · space pause · ←→ ratio · ↑↓ index · q quit${pausedTag(ctx)}`), 80)

keys({
  left: () => { ratio = Math.max(0.1, ratio - 0.5); apply() },
  right: () => { ratio += 0.5; apply() },
  up: () => { index += 1; apply() },
  down: () => { index = Math.max(0, index - 1); apply() },
}, () => { clearInterval(ui); clearLine(); ctx.close() }, ctx)

console.log(`FM: carrier=${carrier}Hz, ratio=${ratio}, index=${index} (${dur}s)  ←→ ratio · ↑↓ index · q quit`)

let t = ctx.currentTime + dur
master.gain.setValueAtTime(0.3, t - 0.1)
master.gain.linearRampToValueAtTime(0, t)
setTimeout(() => { clearInterval(ui); clearLine(); ctx.close(); process.exit(0) }, dur * 1000)
