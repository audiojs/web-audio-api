// Frequency sweep — hear the audible range.
// Run: node examples/sweep.js 20..20k exp 3s
// Run: node examples/sweep.js ..4k lin 5s

import { AudioContext } from 'web-audio-api'

let args = process.argv.slice(2), kv = {}, pos = []
for (let s of args) { let e = s.indexOf('='); e > 0 ? kv[s.slice(0, e)] = s.slice(e + 1) : pos.push(s) }
let $ = (k, d) => { for (let p in kv) if (k.startsWith(p) || p.startsWith(k)) return kv[p]; return d }
let semi = 'C.D.EF.G.A.B'
let num = v => { v += ''; let m = v.match(/^([A-G])([#b])?(\d)$/i); return m ? 440 * 2 ** ((semi.indexOf(m[1].toUpperCase()) + (m[2]==='#') - (m[2]==='b') + 12*(+m[3]+1) - 69) / 12) : parseFloat(v) * (/k$/i.test(v) ? 1e3 : 1) }
let sec = v => (v += '', parseFloat(v) * ({s:1,m:60,h:3600}[v.slice(-1)] || 1))

let min = 20, max = 20000
let range = pos.find(t => t.includes('..'))
if (range) { let [a, b] = range.split('..'); if (a) min = num(a); if (b) max = num(b) }
min = min || 20
let mode = pos.find(t => /^[le]/i.test(t)) || $('mode', 'exp')
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '3'))

let ctx = new AudioContext()
await ctx.resume()

let osc = ctx.createOscillator()
let t = ctx.currentTime
osc.frequency.setValueAtTime(min, t)
if (mode[0] === 'l') osc.frequency.linearRampToValueAtTime(max, t + dur)
else osc.frequency.exponentialRampToValueAtTime(max, t + dur)

let gain = ctx.createGain()
gain.gain.setValueAtTime(0, t)
gain.gain.linearRampToValueAtTime(1, t + 0.1)
gain.gain.setValueAtTime(1, t + dur - 0.5)
gain.gain.linearRampToValueAtTime(0, t + dur)

osc.connect(gain).connect(ctx.destination)
osc.start()

setTimeout(() => ctx.close(), dur * 1000)
