// Serial music — twelve-tone technique (Schoenberg / Webern).
// Pointillistic, wide register, sparse — different every run.
// Run: node examples/serial.js 72 30s
// Run: node examples/serial.js tempo=100 dur=1m

import { AudioContext } from 'web-audio-api'
import { args, sec, keys, clearLine } from './_util.js'

let { pos, $ } = args()
let tempo = +(pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t)) || $('tempo', 72))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '30'))

let ctx = new AudioContext()
await ctx.resume()

// Generate random 12-tone row (permutation of 0-11)
let row = Array.from({ length: 12 }, (_, i) => i)
for (let i = 11; i > 0; i--) {
  let j = Math.random() * (i + 1) | 0
  ;[row[i], row[j]] = [row[j], row[i]]
}

// Four canonical row forms
let P = row
let R = [...row].reverse()
let I = row.map(n => (12 - n) % 12)
let RI = [...I].reverse()
let forms = [P, R, I, RI]

let pick = a => a[Math.random() * a.length | 0]
let beat = 60 / tempo

let master = ctx.createGain()
master.gain.value = 0.25
master.connect(ctx.destination)

let t = ctx.currentTime
let end = t + dur

// Webern-style: vary octave, timbre, dynamics per note
while (t < end) {
  let form = pick(forms)
  let trans = Math.random() * 12 | 0

  for (let pc of form) {
    if (t >= end) break
    let note = (pc + trans) % 12
    // Wide register: C2 to C6
    let octave = 2 + (Math.random() * 4 | 0)
    let freq = 16.35 * (2 ** ((note + octave * 12) / 12))

    let noteDur = pick([0.5, 0.75, 1, 1.5, 2]) * beat
    let gap = pick([0, 0, 0.25, 0.5, 1]) * beat

    let osc = ctx.createOscillator()
    osc.type = pick(['sine', 'triangle', 'square'])
    osc.frequency.value = freq

    let vol = 0.1 + Math.random() * 0.4
    let env = ctx.createGain()
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(vol, t + 0.01)
    env.gain.setValueAtTime(vol * 0.7, t + noteDur * 0.3)
    env.gain.exponentialRampToValueAtTime(0.001, t + noteDur)

    osc.connect(env).connect(master)
    osc.start(t); osc.stop(t + noteDur + 0.01)

    t += noteDur + gap
  }
  // Silence between row statements
  t += beat * pick([0.5, 1, 1.5])
}

keys({}, () => { clearLine(); ctx.close() }, ctx)
console.log(`12-tone row: [${row.join(' ')}], ~${tempo} BPM (${dur}s)  space pause · q quit`)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, dur * 1000 + 500)
