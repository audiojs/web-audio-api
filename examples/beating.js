// Beating — two close frequencies create amplitude modulation.
// Run: node examples/beating.js 440 3 5s
// Run: node examples/beating.js freq=440 diff=3 -d 5s
// Keys: ←/→ ±0.5 Hz beat · ↑/↓ ±semitone carrier · q quit

import { AudioContext } from 'web-audio-api'
import { args, num, sec, keys, status, clearLine, pausedTag } from './_util.js'

let { pos, $ } = args()
let nums = pos.filter(t => /^\d/.test(t) && !/[smh]$/.test(t) || /^[A-G][#b]?\d$/i.test(t))
let f = num(nums[0] || $('freq', 440))
let diff = +(nums[1] || $('diff', 3))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '30'))

let ctx = new AudioContext()
await ctx.resume()

let osc1 = ctx.createOscillator(), osc2 = ctx.createOscillator()
osc1.frequency.value = f
osc2.frequency.value = f + diff
let master = ctx.createGain()
master.gain.value = 0.3
osc1.connect(master); osc2.connect(master); master.connect(ctx.destination)
osc1.start(); osc2.start()

let retune = () => {
  let t = ctx.currentTime
  osc1.frequency.setTargetAtTime(f, t, 0.02)
  osc2.frequency.setTargetAtTime(f + diff, t, 0.02)
}

let render = status()
let ui = setInterval(() => render(`${f.toFixed(2)}Hz + ${(f + diff).toFixed(2)}Hz · beat ${diff.toFixed(2)}Hz · space pause · ←→ beat · ↑↓ carrier · q quit${pausedTag(ctx)}`), 80)

keys({
  left: () => { diff = Math.max(0.1, diff - 0.5); retune() },
  right: () => { diff += 0.5; retune() },
  up: () => { f *= 2 ** (1/12); retune() },
  down: () => { f *= 2 ** (-1/12); retune() },
}, () => { clearInterval(ui); clearLine(); ctx.close() }, ctx)

console.log(`${f}Hz + ${f + diff}Hz → ${diff}Hz beating  (${dur}s)  ←→ beat · ↑↓ carrier · q quit`)

let t = ctx.currentTime + dur
master.gain.setValueAtTime(0.3, t - 0.05)
master.gain.linearRampToValueAtTime(0, t)
setTimeout(() => { clearInterval(ui); clearLine(); ctx.close(); process.exit(0) }, dur * 1000)
