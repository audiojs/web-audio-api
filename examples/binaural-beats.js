// Binaural beats — slightly different frequencies in each ear.
// Run: node examples/binaural-beats.js 200 10 10s
// Run: node examples/binaural-beats.js freq=200 beat=10 dur=10s

import { AudioContext } from 'web-audio-api'

let args = process.argv.slice(2), kv = {}, pos = []
for (let s of args) { let e = s.indexOf('='); e > 0 ? kv[s.slice(0, e)] = s.slice(e + 1) : pos.push(s) }
let $ = (k, d) => { for (let p in kv) if (k.startsWith(p) || p.startsWith(k)) return kv[p]; return d }
let semi = 'C.D.EF.G.A.B'
let num = v => { v += ''; let m = v.match(/^([A-G])([#b])?(\d)$/i); return m ? 440 * 2 ** ((semi.indexOf(m[1].toUpperCase()) + (m[2]==='#') - (m[2]==='b') + 12*(+m[3]+1) - 69) / 12) : parseFloat(v) * (/k$/i.test(v) ? 1e3 : 1) }
let sec = v => (v += '', parseFloat(v) * ({s:1,m:60,h:3600}[v.slice(-1)] || 1))

let nums = pos.filter(t => /^\d/.test(t) && !/[smh]$/.test(t) || /^[A-G][#b]?\d$/i.test(t))
let f = num(nums[0] || $('freq', 200))
let beat = +(nums[1] || $('beat', 10))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '10'))

let ctx = new AudioContext()
await ctx.resume()

// Left ear: base frequency
let oscL = ctx.createOscillator()
oscL.frequency.value = f
let panL = ctx.createStereoPanner()
panL.pan.value = -1

// Right ear: base + beat frequency
let oscR = ctx.createOscillator()
oscR.frequency.value = f + beat
let panR = ctx.createStereoPanner()
panR.pan.value = 1

let master = ctx.createGain()
master.gain.value = 0.3
oscL.connect(panL).connect(master)
oscR.connect(panR).connect(master)
master.connect(ctx.destination)

oscL.start(); oscR.start()

console.log(`L: ${f}Hz  R: ${f + beat}Hz  beat: ${beat}Hz — use headphones`)

let t = ctx.currentTime + dur
master.gain.setValueAtTime(0.3, t - 0.05)
master.gain.linearRampToValueAtTime(0, t)
setTimeout(() => ctx.close(), dur * 1000)
