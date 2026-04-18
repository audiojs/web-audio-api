// Binaural beats — slightly different frequencies in each ear.
// Run: node examples/binaural-beats.js 200 10 10s
// Run: node examples/binaural-beats.js freq=200 beat=10 -d 10s
// Keys: ←/→ ±0.5 Hz beat · ↑/↓ ±semitone carrier · q quit

import { AudioContext } from 'web-audio-api'
import { args, num, sec, keys, status, clearLine, pausedTag } from './_util.js'

let { pos, $ } = args()
let nums = pos.filter(t => /^\d/.test(t) && !/[smh]$/.test(t) || /^[A-G][#b]?\d$/i.test(t))
let f = num(nums[0] || $('freq', 200))
let beat = +(nums[1] || $('beat', 10))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '60'))

let ctx = new AudioContext()
await ctx.resume()

let oscL = ctx.createOscillator(), oscR = ctx.createOscillator()
oscL.frequency.value = f
oscR.frequency.value = f + beat
let panL = ctx.createStereoPanner(), panR = ctx.createStereoPanner()
panL.pan.value = -1; panR.pan.value = 1
let master = ctx.createGain()
master.gain.value = 0.3
oscL.connect(panL).connect(master)
oscR.connect(panR).connect(master)
master.connect(ctx.destination)
oscL.start(); oscR.start()

let retune = () => {
  let t = ctx.currentTime
  oscL.frequency.setTargetAtTime(f, t, 0.02)
  oscR.frequency.setTargetAtTime(f + beat, t, 0.02)
}

let render = status()
let ui = setInterval(() => render(`L ${f.toFixed(2)}Hz · R ${(f + beat).toFixed(2)}Hz · beat ${beat.toFixed(2)}Hz · space pause · ←→ beat · ↑↓ carrier · q quit${pausedTag(ctx)}`), 80)

keys({
  left: () => { beat = Math.max(0.1, beat - 0.5); retune() },
  right: () => { beat += 0.5; retune() },
  up: () => { f *= 2 ** (1/12); retune() },
  down: () => { f *= 2 ** (-1/12); retune() },
}, () => { clearInterval(ui); clearLine(); ctx.close() }, ctx)

console.log(`L: ${f}Hz  R: ${f + beat}Hz  beat: ${beat}Hz — use headphones  (${dur}s)`)

let t = ctx.currentTime + dur
master.gain.setValueAtTime(0.3, t - 0.05)
master.gain.linearRampToValueAtTime(0, t)
setTimeout(() => { clearInterval(ui); clearLine(); ctx.close(); process.exit(0) }, dur * 1000)
