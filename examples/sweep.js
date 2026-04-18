// Frequency sweep — hear the audible range.
// Run: node examples/sweep.js 20..20k exp 3s
// Run: node examples/sweep.js ..4k lin -d 5s
// Keys: space pause · r restart · ←/→ halve/double duration · m toggle lin/exp · q quit

import { AudioContext } from 'web-audio-api'
import { args, num, sec, keys, status, clearLine, pausedTag } from './_util.js'

let { pos, $ } = args()
let min = 20, max = 20000
let range = pos.find(t => t.includes('..'))
if (range) { let [a, b] = range.split('..'); if (a) min = num(a); if (b) max = num(b) }
min = min || 20
let mode = pos.find(t => /^[le]/i.test(t)) || $('mode', 'exp')
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '3'))

let ctx = new AudioContext()
await ctx.resume()

let osc, gain, t0
let start = () => {
  if (osc) try { osc.stop() } catch {}
  osc = ctx.createOscillator()
  gain = ctx.createGain()
  t0 = ctx.currentTime
  osc.frequency.setValueAtTime(min, t0)
  if (mode[0] === 'l') osc.frequency.linearRampToValueAtTime(max, t0 + dur)
  else osc.frequency.exponentialRampToValueAtTime(max, t0 + dur)
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(0.5, t0 + 0.1)
  gain.gain.setValueAtTime(0.5, t0 + dur - 0.2)
  gain.gain.linearRampToValueAtTime(0, t0 + dur)
  osc.connect(gain).connect(ctx.destination)
  osc.start()
}
start()

let render = status()
let ui = setInterval(() => {
  let p = Math.min(Math.max((ctx.currentTime - t0) / dur, 0), 1)
  let f = mode[0] === 'l' ? min + (max - min) * p : min * (max / min) ** p
  let bar = '█'.repeat(Math.floor(p * 20)).padEnd(20, '░')
  render(`${mode[0] === 'l' ? 'lin' : 'exp'} ${min}→${max}Hz · ${f.toFixed(0).padStart(6)}Hz ${bar} ${(p * 100).toFixed(0).padStart(3)}% · ${dur}s${pausedTag(ctx)}`)
}, 50)

keys({
  r: () => start(),
  left: () => { dur = Math.max(0.5, dur / 2); start() },
  right: () => { dur = Math.min(60, dur * 2); start() },
  m: () => { mode = mode[0] === 'l' ? 'exp' : 'lin'; start() },
}, () => { clearInterval(ui); clearLine(); ctx.close() }, ctx)

console.log(`sweep ${min}→${max}Hz ${mode} (${dur}s)  space pause · r restart · ←→ speed · m mode · q quit`)
setTimeout(() => { clearInterval(ui); clearLine(); ctx.close(); process.exit(0) }, dur * 1000 * 3 + 1000)
