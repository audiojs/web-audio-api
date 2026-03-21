// Drone — tanpura-like harmonic drone with natural beating.
// Four strings: Pa, Sa, Sa (detuned), Sa (low octave).
// Run: node examples/drone.js 130.81 30s
// Run: node examples/drone.js freq=261.63 dur=2m

import { AudioContext } from 'web-audio-api'

let args = process.argv.slice(2), kv = {}, pos = []
for (let s of args) { let e = s.indexOf('='); e > 0 ? kv[s.slice(0, e)] = s.slice(e + 1) : pos.push(s) }
let $ = (k, d) => { for (let p in kv) if (k.startsWith(p) || p.startsWith(k)) return kv[p]; return d }
let semi = 'C.D.EF.G.A.B'
let num = v => { v += ''; let m = v.match(/^([A-G])([#b])?(\d)$/i); return m ? 440 * 2 ** ((semi.indexOf(m[1].toUpperCase()) + (m[2]==='#') - (m[2]==='b') + 12*(+m[3]+1) - 69) / 12) : parseFloat(v) * (/k$/i.test(v) ? 1e3 : 1) }
let sec = v => (v += '', parseFloat(v) * ({s:1,m:60,h:3600}[v.slice(-1)] || 1))

let f = num(pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t) || /^[A-G][#b]?\d$/i.test(t)) || $('freq', 130.81))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '30'))

let ctx = new AudioContext()
await ctx.resume()

// Tanpura tuning: Pa (5th), Sa (root), Sa (micro-detuned), Sa (octave below)
let strings = [
  { freq: f * 3 / 2 },   // Pa
  { freq: f },            // Sa
  { freq: f * 1.001 },    // Sa — beating against the other Sa
  { freq: f / 2 },        // Sa low octave
]

let master = ctx.createGain()
master.connect(ctx.destination)

// Each string: harmonics 1-10 with micro-detuning for shimmer
// The jwari (bridge buzz) emphasizes higher harmonics
for (let { freq } of strings) {
  for (let h = 1; h <= 10; h++) {
    let osc = ctx.createOscillator()
    osc.frequency.value = freq * h * (1 + (Math.random() - 0.5) * 0.0005)
    let amp = h <= 3 ? 1 / h : 0.7 / h
    let g = ctx.createGain()
    g.gain.value = amp
    osc.connect(g).connect(master)
    osc.start()
    osc.stop(ctx.currentTime + dur + 0.1)
  }
}

// Gentle fade in / out
let t0 = ctx.currentTime
master.gain.setValueAtTime(0, t0)
master.gain.linearRampToValueAtTime(0.08, t0 + 2)
master.gain.setValueAtTime(0.08, t0 + dur - 2)
master.gain.linearRampToValueAtTime(0, t0 + dur)

console.log(`Drone: Sa = ${f.toFixed(1)}Hz (${dur}s)`)
setTimeout(() => ctx.close(), dur * 1000 + 200)
