// Gamelan — Balinese-style interlocking patterns (kotekan).
// Slendro scale, metalophone timbre, colotomic gong structure.
// Run: node examples/gamelan.js 120 20s
// Run: node examples/gamelan.js tempo=140 dur=1m

import { AudioContext } from 'web-audio-api'

let args = process.argv.slice(2), kv = {}, pos = []
for (let s of args) { let e = s.indexOf('='); e > 0 ? kv[s.slice(0, e)] = s.slice(e + 1) : pos.push(s) }
let $ = (k, d) => { for (let p in kv) if (k.startsWith(p) || p.startsWith(k)) return kv[p]; return d }
let sec = v => (v += '', parseFloat(v) * ({s:1,m:60,h:3600}[v.slice(-1)] || 1))

let tempo = +(pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t)) || $('tempo', 120))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '20'))

let ctx = new AudioContext()
await ctx.resume()

// Slendro scale — 5-tone near-equal temperament (cent offsets from base)
let base = 440
let slendro = [0, 240, 480, 720, 960].map(c => base * 2 ** (c / 1200))
let hiOct = slendro.map(f => f * 2)

let beat = 60 / tempo

// Metalophone voice: sine + inharmonic partial for metallic ring
let metal = (freq, when, vol = 0.3) => {
  let env = ctx.createGain()
  env.gain.setValueAtTime(0, when)
  env.gain.linearRampToValueAtTime(vol, when + 0.003)
  env.gain.exponentialRampToValueAtTime(0.001, when + beat * 3)
  env.connect(ctx.destination)

  let osc = ctx.createOscillator()
  osc.frequency.value = freq
  osc.connect(env)
  osc.start(when); osc.stop(when + beat * 3 + 0.01)

  // Non-integer harmonic ratio = metallic character
  let osc2 = ctx.createOscillator()
  osc2.frequency.value = freq * 2.76
  let g2 = ctx.createGain(); g2.gain.value = 0.15
  osc2.connect(g2).connect(env)
  osc2.start(when); osc2.stop(when + beat * 3 + 0.01)
}

// Kotekan melody — two interlocking parts
let melody = [0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 4, 3, 2, 1, 0, 1]

let t = ctx.currentTime
let nBeats = Math.floor(dur / beat)
for (let i = 0; i < nBeats; i++) {
  let when = t + i * beat
  let deg = melody[i % melody.length]

  // Polos (high register) on even beats, sangsih (low) on odd
  if (i % 2 === 0) metal(hiOct[deg], when, 0.2)
  else metal(slendro[deg], when, 0.25)

  // Gong marks every 16 beats (colotomic structure)
  if (i % 16 === 0) {
    let gong = ctx.createOscillator()
    gong.frequency.value = slendro[0] / 2
    let gEnv = ctx.createGain()
    gEnv.gain.setValueAtTime(0, when)
    gEnv.gain.linearRampToValueAtTime(0.4, when + 0.01)
    gEnv.gain.exponentialRampToValueAtTime(0.001, when + beat * 8)
    gong.connect(gEnv).connect(ctx.destination)
    gong.start(when); gong.stop(when + beat * 8 + 0.01)
  }
}

console.log(`Gamelan kotekan: slendro, ${tempo} BPM (${dur}s)`)
setTimeout(() => ctx.close(), dur * 1000 + 500)
