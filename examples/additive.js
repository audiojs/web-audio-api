// Additive synthesis — build waveforms from individual harmonics.
// Run: node examples/additive.js square 220 16 3s
// Run: node examples/additive.js wave=saw freq=1k n=32 -d 5s
// Keys: q quit

import { AudioContext } from 'web-audio-api'
import { args, num, sec, keys, clearLine } from './_util.js'

let { pos, $ } = args()
let wave = pos.find(t => /^[a-z]/i.test(t) && !/^[A-G][#b]?\d$/i.test(t)) || $('wave', 'square')
let nums = pos.filter(t => /^\d/.test(t) && !/[smh]$/.test(t) || /^[A-G][#b]?\d$/i.test(t))
let f = num(nums[0] || $('freq', 220))
let n = +(nums[1] || $('n', 16))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '3'))

let ctx = new AudioContext()
await ctx.resume()

let master = ctx.createGain()
master.gain.value = 0.3
master.connect(ctx.destination)

let amp = h => {
  switch (wave) {
    case 'square':   return h % 2 ? 1 / h : 0
    case 'saw':      return 1 / h
    case 'triangle': return h % 2 ? ((-1) ** ((h - 1) / 2)) / (h * h) : 0
    default:         return 1 / h
  }
}

for (let h = 1; h <= n; h++) {
  let v = amp(h)
  if (Math.abs(v) < 0.001) continue
  let osc = ctx.createOscillator()
  osc.frequency.value = f * h
  let g = ctx.createGain()
  g.gain.value = v
  osc.connect(g).connect(master)
  osc.start()
  osc.stop(ctx.currentTime + dur + 0.01)
}

keys({}, () => { clearLine(); ctx.close() }, ctx)
console.log(`Additive ${wave}: ${f}Hz, ${n} harmonics (${dur}s)  space pause · q quit`)

let t = ctx.currentTime + dur
master.gain.setValueAtTime(0.3, t - 0.1)
master.gain.linearRampToValueAtTime(0, t)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, dur * 1000)
