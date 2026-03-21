// Risset rhythm — infinitely accelerating or decelerating beat.
// The rhythmic analog of the Shepard tone.
// Run: node examples/risset-rhythm.js up 120 20s
// Run: node examples/risset-rhythm.js dir=down bpm=90 dur=30s

import { AudioContext } from 'web-audio-api'

let args = process.argv.slice(2), kv = {}, pos = []
for (let s of args) { let e = s.indexOf('='); e > 0 ? kv[s.slice(0, e)] = s.slice(e + 1) : pos.push(s) }
let $ = (k, d) => { for (let p in kv) if (k.startsWith(p) || p.startsWith(k)) return kv[p]; return d }
let sec = v => (v += '', parseFloat(v) * ({s:1,m:60,h:3600}[v.slice(-1)] || 1))

let dir = pos.find(t => /^(up|down)$/i.test(t)) || $('dir', 'up')
let bpm = +(pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t)) || $('bpm', 120))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '20'))

let sign = dir === 'down' ? -1 : 1
let ctx = new AudioContext()
await ctx.resume()

let nVoices = 6
let period = 10  // seconds per tempo octave
let sigma = 0.35 // Gaussian width — controls crossfade smoothness

let click = (when, amp) => {
  if (amp < 0.01) return
  let osc = ctx.createOscillator()
  osc.frequency.setValueAtTime(1200, when)
  osc.frequency.exponentialRampToValueAtTime(400, when + 0.01)
  let env = ctx.createGain()
  env.gain.setValueAtTime(amp * 0.5, when)
  env.gain.exponentialRampToValueAtTime(0.001, when + 0.04)
  osc.connect(env).connect(ctx.destination)
  osc.start(when); osc.stop(when + 0.06)
}

let t0 = ctx.currentTime
for (let v = 0; v < nVoices; v++) {
  let offset = v / nVoices
  let t = 0
  while (t < dur) {
    let phase = ((t / period * sign + offset) % 1 + 1) % 1
    let tempo = bpm * (2 ** phase)
    let amp = Math.exp(-0.5 * ((phase - 0.5) / sigma) ** 2)
    click(t0 + t, amp)
    t += 60 / tempo
  }
}

console.log(`Risset rhythm: ${dir}, ~${bpm} BPM center (${dur}s)`)
setTimeout(() => ctx.close(), dur * 1000 + 500)
