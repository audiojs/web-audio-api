// Beating — two close frequencies create amplitude modulation.
// Run: node examples/beating.js 440 3 5s
// Run: node examples/beating.js freq=440 diff=3 dur=5s

import { AudioContext } from 'web-audio-api'

let args = process.argv.slice(2), kv = {}, pos = []
for (let s of args) { let e = s.indexOf('='); e > 0 ? kv[s.slice(0, e)] = s.slice(e + 1) : pos.push(s) }
let $ = (k, d) => { for (let p in kv) if (k.startsWith(p) || p.startsWith(k)) return kv[p]; return d }
let semi = 'C.D.EF.G.A.B'
let num = v => { v += ''; let m = v.match(/^([A-G])([#b])?(\d)$/i); return m ? 440 * 2 ** ((semi.indexOf(m[1].toUpperCase()) + (m[2]==='#') - (m[2]==='b') + 12*(+m[3]+1) - 69) / 12) : parseFloat(v) * (/k$/i.test(v) ? 1e3 : 1) }
let sec = v => (v += '', parseFloat(v) * ({s:1,m:60,h:3600}[v.slice(-1)] || 1))

let nums = pos.filter(t => /^\d/.test(t) && !/[smh]$/.test(t) || /^[A-G][#b]?\d$/i.test(t))
let f = num(nums[0] || $('freq', 440))
let diff = +(nums[1] || $('diff', 3))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '5'))

let ctx = new AudioContext()
await ctx.resume()

let osc1 = ctx.createOscillator()
osc1.frequency.value = f

let osc2 = ctx.createOscillator()
osc2.frequency.value = f + diff

let master = ctx.createGain()
master.gain.value = 0.3
osc1.connect(master)
osc2.connect(master)
master.connect(ctx.destination)

osc1.start(); osc2.start()

console.log(`${f}Hz + ${f + diff}Hz → ${diff}Hz beating`)

let t = ctx.currentTime + dur
master.gain.setValueAtTime(0.3, t - 0.05)
master.gain.linearRampToValueAtTime(0, t)
setTimeout(() => ctx.close(), dur * 1000)
