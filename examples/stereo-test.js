// Stereo test — left, right, center channel identification.
// Run: node examples/stereo-test.js 1k 1s
// Run: node examples/stereo-test.js freq=500 dur=2s

import { AudioContext } from 'web-audio-api'

let args = process.argv.slice(2), kv = {}, pos = []
for (let s of args) { let e = s.indexOf('='); e > 0 ? kv[s.slice(0, e)] = s.slice(e + 1) : pos.push(s) }
let $ = (k, d) => { for (let p in kv) if (k.startsWith(p) || p.startsWith(k)) return kv[p]; return d }
let semi = 'C.D.EF.G.A.B'
let num = v => { v += ''; let m = v.match(/^([A-G])([#b])?(\d)$/i); return m ? 440 * 2 ** ((semi.indexOf(m[1].toUpperCase()) + (m[2]==='#') - (m[2]==='b') + 12*(+m[3]+1) - 69) / 12) : parseFloat(v) * (/k$/i.test(v) ? 1e3 : 1) }
let sec = v => (v += '', parseFloat(v) * ({s:1,m:60,h:3600}[v.slice(-1)] || 1))

let f = num(pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t) || /^[A-G][#b]?\d$/i.test(t)) || $('freq', 1000))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '1'))

let ctx = new AudioContext()
await ctx.resume()

let tests = [['Left', -1], ['Right', 1], ['Center', 0]]
let gap = 0.3

let t = ctx.currentTime
for (let [name, pan] of tests) {
  console.log(name)
  let osc = ctx.createOscillator()
  osc.frequency.value = f
  let panner = ctx.createStereoPanner()
  panner.pan.value = pan

  let env = ctx.createGain()
  env.gain.setValueAtTime(0, t)
  env.gain.linearRampToValueAtTime(0.5, t + 0.02)
  env.gain.setValueAtTime(0.5, t + dur - 0.05)
  env.gain.linearRampToValueAtTime(0, t + dur)

  osc.connect(panner).connect(env).connect(ctx.destination)
  osc.start(t); osc.stop(t + dur + 0.01)
  t += dur + gap
}

setTimeout(() => ctx.close(), tests.length * (dur + gap) * 1000)
