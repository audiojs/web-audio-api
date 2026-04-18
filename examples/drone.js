// Drone — tanpura-like harmonic drone with natural beating.
// Four strings: Pa, Sa, Sa (detuned), Sa (low octave).
// Run: node examples/drone.js 130.81 30s
// Run: node examples/drone.js freq=C3 -d 2m
// Keys: space pause · ↑/↓ ±semitone · ←/→ ±5 cents · 1-7 scale degrees · q quit

import { AudioContext } from 'web-audio-api'
import { args, num, sec, keys, status, clearLine, noteName, pausedTag } from './_util.js'

let { pos, $ } = args()

let f = num(pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t) || /^[A-G][#b]?\d$/i.test(t)) || $('freq', 130.81))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '300'))

let ctx = new AudioContext()
await ctx.resume()

let master = ctx.createGain()
master.connect(ctx.destination)

let strings = []
let build = freq => {
  // Tanpura tuning: Pa (5th), Sa, Sa detuned, Sa low
  let ratios = [3 / 2, 1, 1.001, 0.5]
  return ratios.map(r => {
    let stringFreq = freq * r
    let harmonics = []
    for (let h = 1; h <= 10; h++) {
      let osc = ctx.createOscillator()
      osc.frequency.value = stringFreq * h * (1 + (Math.random() - 0.5) * 0.0005)
      let amp = h <= 3 ? 1 / h : 0.7 / h
      let g = ctx.createGain()
      g.gain.value = amp
      osc.connect(g).connect(master)
      osc.start()
      harmonics.push({ osc, h, r })
    }
    return harmonics
  }).flat()
}

strings = build(f)

let retune = freq => {
  f = freq
  let t = ctx.currentTime
  for (let { osc, h, r } of strings) {
    osc.frequency.setTargetAtTime(freq * r * h * (1 + (Math.random() - 0.5) * 0.0005), t, 0.08)
  }
}

let t0 = ctx.currentTime
master.gain.setValueAtTime(0, t0)
master.gain.linearRampToValueAtTime(0.08, t0 + 2)

let render = status()
let draw = () => render(`Sa = ${f.toFixed(2)}Hz  ${noteName(f).padEnd(4)}  ↑↓ semi · ←→ cents · 1-7 scale · space pause · q quit${pausedTag(ctx)}`)
let ui = setInterval(draw, 80)

let scale = [0, 2, 4, 5, 7, 9, 11] // C major semitone offsets
let base = f
let semiShift = v => retune(base * 2 ** (v / 12))

keys({
  up: () => { base = f * 2 ** (1 / 12); retune(base) },
  down: () => { base = f * 2 ** (-1 / 12); retune(base) },
  right: () => { base = f * 2 ** (5 / 1200); retune(base) },  // +5 cents
  left: () => { base = f * 2 ** (-5 / 1200); retune(base) },
  1: () => semiShift(scale[0]), 2: () => semiShift(scale[1]), 3: () => semiShift(scale[2]),
  4: () => semiShift(scale[3]), 5: () => semiShift(scale[4]), 6: () => semiShift(scale[5]),
  7: () => semiShift(scale[6]),
}, () => {
  clearInterval(ui); clearLine()
  let t = ctx.currentTime
  master.gain.cancelScheduledValues(t)
  master.gain.setValueAtTime(master.gain.value, t)
  master.gain.linearRampToValueAtTime(0, t + 0.3)
  setTimeout(() => ctx.close(), 400)
}, ctx)

console.log(`Drone: Sa = ${f.toFixed(2)}Hz ${noteName(f)} (${dur}s)  ↑↓ semi · ←→ cents · 1-7 scale · q quit`)

setTimeout(() => {
  let t = ctx.currentTime
  master.gain.setValueAtTime(master.gain.value, t)
  master.gain.linearRampToValueAtTime(0, t + 2)
}, (dur - 2) * 1000)
setTimeout(() => { clearInterval(ui); clearLine(); ctx.close(); process.exit(0) }, dur * 1000 + 200)
