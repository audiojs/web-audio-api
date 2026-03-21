// Additive synthesis — build waveforms from individual harmonics.
// Run: node examples/additive.js square 220 16 3s
// Run: node examples/additive.js wave=saw freq=1k n=32 dur=5s

import { AudioContext } from 'web-audio-api'

let args = process.argv.slice(2), kv = {}, pos = []
for (let s of args) { let e = s.indexOf('='); e > 0 ? kv[s.slice(0, e)] = s.slice(e + 1) : pos.push(s) }
let $ = (k, d) => { for (let p in kv) if (k.startsWith(p) || p.startsWith(k)) return kv[p]; return d }
let semi = 'C.D.EF.G.A.B'
let num = v => { v += ''; let m = v.match(/^([A-G])([#b])?(\d)$/i); return m ? 440 * 2 ** ((semi.indexOf(m[1].toUpperCase()) + (m[2]==='#') - (m[2]==='b') + 12*(+m[3]+1) - 69) / 12) : parseFloat(v) * (/k$/i.test(v) ? 1e3 : 1) }
let sec = v => (v += '', parseFloat(v) * ({s:1,m:60,h:3600}[v.slice(-1)] || 1))

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

// Harmonic recipes — Fourier series coefficients
let amp = h => {
  switch (wave) {
    case 'square':   return h % 2 ? 1 / h : 0                          // odd harmonics only
    case 'saw':      return 1 / h                                       // all harmonics
    case 'triangle': return h % 2 ? ((-1) ** ((h - 1) / 2)) / (h * h) : 0 // odd, 1/h²
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

console.log(`Additive ${wave}: ${f}Hz, ${n} harmonics`)

let t = ctx.currentTime + dur
master.gain.setValueAtTime(0.3, t - 0.1)
master.gain.linearRampToValueAtTime(0, t)
setTimeout(() => ctx.close(), dur * 1000)
