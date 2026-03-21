// Reference tone — the A440 of audio testing.
// Run: node examples/tone.js sine 440 2s
// Run: node examples/tone.js wave=triangle freq=1k dur=5s

import { AudioContext } from 'web-audio-api'

let args = process.argv.slice(2), kv = {}, pos = []
for (let s of args) { let e = s.indexOf('='); e > 0 ? kv[s.slice(0, e)] = s.slice(e + 1) : pos.push(s) }
let $ = (k, d) => { for (let p in kv) if (k.startsWith(p) || p.startsWith(k)) return kv[p]; return d }
let semi = 'C.D.EF.G.A.B'
let num = v => { v += ''; let m = v.match(/^([A-G])([#b])?(\d)$/i); return m ? 440 * 2 ** ((semi.indexOf(m[1].toUpperCase()) + (m[2]==='#') - (m[2]==='b') + 12*(+m[3]+1) - 69) / 12) : parseFloat(v) * (/k$/i.test(v) ? 1e3 : 1) }
let sec = v => (v += '', parseFloat(v) * ({s:1,m:60,h:3600}[v.slice(-1)] || 1))

let wave = pos.find(t => /^[a-z]/i.test(t) && !/^[A-G][#b]?\d$/i.test(t)) || $('wave', 'sine')
let f = num(pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t) || /^[A-G][#b]?\d$/i.test(t)) || $('freq', 440))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '2'))

let ctx = new AudioContext()
await ctx.resume()

let osc = ctx.createOscillator()
osc.type = wave
osc.frequency.value = f

let master = ctx.createGain()
osc.connect(master).connect(ctx.destination)
osc.start()

let t = ctx.currentTime + dur
master.gain.setValueAtTime(1, t - 0.05)
master.gain.linearRampToValueAtTime(0, t)
setTimeout(() => ctx.close(), dur * 1000)
