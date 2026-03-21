// FM synthesis — DX7-style frequency modulation.
// Run: node examples/fm-synthesis.js 440 2 5 3s
// Run: node examples/fm-synthesis.js carrier=440 ratio=2 index=5 dur=3s

import { AudioContext } from 'web-audio-api'

let args = process.argv.slice(2), kv = {}, pos = []
for (let s of args) { let e = s.indexOf('='); e > 0 ? kv[s.slice(0, e)] = s.slice(e + 1) : pos.push(s) }
let $ = (k, d) => { for (let p in kv) if (k.startsWith(p) || p.startsWith(k)) return kv[p]; return d }
let semi = 'C.D.EF.G.A.B'
let num = v => { v += ''; let m = v.match(/^([A-G])([#b])?(\d)$/i); return m ? 440 * 2 ** ((semi.indexOf(m[1].toUpperCase()) + (m[2]==='#') - (m[2]==='b') + 12*(+m[3]+1) - 69) / 12) : parseFloat(v) * (/k$/i.test(v) ? 1e3 : 1) }
let sec = v => (v += '', parseFloat(v) * ({s:1,m:60,h:3600}[v.slice(-1)] || 1))

let nums = pos.filter(t => /^\d/.test(t) && !/[smh]$/.test(t) || /^[A-G][#b]?\d$/i.test(t))
let carrier = num(nums[0] || $('carrier', 440))
let ratio = +(nums[1] || $('ratio', 2))
let index = +(nums[2] || $('index', 5))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '3'))

let ctx = new AudioContext()
await ctx.resume()

let modFreq = carrier * ratio
let modDepth = index * modFreq

// Modulator oscillator
let mod = ctx.createOscillator()
mod.frequency.value = modFreq
let modGain = ctx.createGain()
modGain.gain.value = modDepth

// Modulation envelope — decays for bell-like timbre
let modEnv = ctx.createGain()
let t = ctx.currentTime
modEnv.gain.setValueAtTime(1, t)
modEnv.gain.exponentialRampToValueAtTime(0.01, t + dur * 0.8)

// Carrier oscillator — frequency modulated by modulator
let car = ctx.createOscillator()
car.frequency.value = carrier
mod.connect(modGain).connect(modEnv).connect(car.frequency)

// Output envelope
let master = ctx.createGain()
master.gain.setValueAtTime(0.3, t)
master.gain.setValueAtTime(0.3, t + dur - 0.1)
master.gain.linearRampToValueAtTime(0, t + dur)

car.connect(master).connect(ctx.destination)
mod.start(); car.start()
mod.stop(t + dur + 0.01); car.stop(t + dur + 0.01)

console.log(`FM: carrier=${carrier}Hz, mod=${modFreq}Hz, index=${index}`)
setTimeout(() => ctx.close(), dur * 1000)
