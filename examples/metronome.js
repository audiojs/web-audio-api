// Metronome — programmable click pattern (drum tab notation).
// X = accent, x = hit, - = rest.
// Run: node examples/metronome.js 120 X-x-X-x-
// Run: node examples/metronome.js 120..240 10m Xxx
// Run: node examples/metronome.js bpm=90 dur=30s pat=Xxx hi=800 lo=1600
//   Waltz: Xxx   Rock: X-x-X-x-   Reggaeton: X--x--x-

import { AudioContext } from 'web-audio-api'

let args = process.argv.slice(2), kv = {}, pos = []
for (let s of args) { let e = s.indexOf('='); e > 0 ? kv[s.slice(0, e)] = s.slice(e + 1) : pos.push(s) }
let $ = (k, d) => { for (let p in kv) if (k.startsWith(p) || p.startsWith(k)) return kv[p]; return d }
let semi = 'C.D.EF.G.A.B'
let num = v => { v += ''; let m = v.match(/^([A-G])([#b])?(\d)$/i); return m ? 440 * 2 ** ((semi.indexOf(m[1].toUpperCase()) + (m[2]==='#') - (m[2]==='b') + 12*(+m[3]+1) - 69) / 12) : parseFloat(v) * (/k$/i.test(v) ? 1e3 : 1) }
let sec = v => (v += '', parseFloat(v) * ({s:1,m:60,h:3600}[v.slice(-1)] || 1))

// BPM: number or range (120..240)
let bpmTok = pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t))
let [bpm0, bpm1] = (bpmTok || $('bpm', '120')).toString().split('..').map(Number)
if (!bpm1) bpm1 = bpm0

let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '8'))
let pat = (pos.find(t => /^[Xx.\-]+$/.test(t)) || $('pat', 'X---')).split('')

// Tone: hi/lo freq for accent/ghost (default: woodblock-like click)
let hi = num($('hi', 1000)), lo = num($('lo', 2500))

let ctx = new AudioContext()
await ctx.resume()

let click = (when, ch) => {
  if (ch === '-' || ch === '.') return
  let strong = ch === 'X'
  let f = strong ? hi : lo
  let osc = ctx.createOscillator()
  osc.frequency.setValueAtTime(f, when)
  osc.frequency.exponentialRampToValueAtTime(f * 0.5, when + (strong ? 0.01 : 0.005))
  let env = ctx.createGain()
  env.gain.setValueAtTime(strong ? 0.8 : 0.3, when)
  env.gain.exponentialRampToValueAtTime(0.001, when + (strong ? 0.03 : 0.015))
  osc.connect(env).connect(ctx.destination)
  osc.start(when); osc.stop(when + 0.05)
}

// Schedule with interpolated tempo
let t = ctx.currentTime, end = t + dur, i = 0
while (t < end) {
  let progress = (t - ctx.currentTime) / dur
  let bpm = bpm0 + (bpm1 - bpm0) * progress
  let step = 30 / bpm
  click(t, pat[i % pat.length])
  t += step; i++
}

let label = bpm0 === bpm1 ? `♩ = ${bpm0}` : `♩ = ${bpm0}→${bpm1}`
console.log(`${label}  [${pat.join('')}]  (${dur}s)`)
setTimeout(() => ctx.close(), dur * 1000 + 200)
