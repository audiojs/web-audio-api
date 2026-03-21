// Missing fundamental — hear a pitch that isn't there.
// Only harmonics 2–6 are played; the brain fills in the fundamental.
// Run: node examples/missing-fundamental.js 100 3s
// Run: node examples/missing-fundamental.js freq=80 dur=5s

import { AudioContext } from 'web-audio-api'

let args = process.argv.slice(2), kv = {}, pos = []
for (let s of args) { let e = s.indexOf('='); e > 0 ? kv[s.slice(0, e)] = s.slice(e + 1) : pos.push(s) }
let $ = (k, d) => { for (let p in kv) if (k.startsWith(p) || p.startsWith(k)) return kv[p]; return d }
let semi = 'C.D.EF.G.A.B'
let num = v => { v += ''; let m = v.match(/^([A-G])([#b])?(\d)$/i); return m ? 440 * 2 ** ((semi.indexOf(m[1].toUpperCase()) + (m[2]==='#') - (m[2]==='b') + 12*(+m[3]+1) - 69) / 12) : parseFloat(v) * (/k$/i.test(v) ? 1e3 : 1) }
let sec = v => (v += '', parseFloat(v) * ({s:1,m:60,h:3600}[v.slice(-1)] || 1))

let f = num(pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t) || /^[A-G][#b]?\d$/i.test(t)) || $('freq', 100))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '3'))

let ctx = new AudioContext()
await ctx.resume()

let master = ctx.createGain()
master.gain.value = 0.15
master.connect(ctx.destination)

// Play harmonics 2 through 6 — skip the fundamental
for (let h = 2; h <= 6; h++) {
  let osc = ctx.createOscillator()
  osc.frequency.value = f * h
  let g = ctx.createGain()
  g.gain.value = 1 / h // natural harmonic rolloff
  osc.connect(g).connect(master)
  osc.start()
  osc.stop(ctx.currentTime + dur + 0.01)
}

console.log(`Harmonics of ${f}Hz: ${[2, 3, 4, 5, 6].map(h => f * h + 'Hz').join(', ')}`)
console.log(`You hear ${f}Hz — but it's not there.`)

let t = ctx.currentTime + dur
master.gain.setValueAtTime(0.15, t - 0.05)
master.gain.linearRampToValueAtTime(0, t)
setTimeout(() => ctx.close(), dur * 1000)
