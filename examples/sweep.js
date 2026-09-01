// Frequency sweep — hear the audible range.
// Run: node examples/sweep.js 20..20k exp 3s
// Run: node examples/sweep.js ..4k lin -d 5s
// Keys: space pause · r restart · ←/→ halve/double duration · m toggle lin/exp · q quit

import { AudioContext } from 'web-audio-api'
import { init as buildSweep } from './graphs/sweep.js'
import { args, num, sec, keys, status, clearLine, pausedTag, help } from './utils.js'

help({
  description: 'sweep across a frequency range',
  usage: ['', '[start]..[end] [exp|lin] [duration]', '..4k lin -d 5s'],
  options: [
    ['start..end', 'range in Hz; either endpoint may be omitted (default: 20..20k)'],
    ['mode=<exp|lin>', 'exponential (default) or linear sweep'],
    ['-d, --duration <time>', 'time per sweep with optional s/m/h suffix (default: 3s)'],
  ],
  controls: [['Space', 'pause/resume'], ['R', 'restart'], ['← / →', 'halve/double duration'], ['M', 'toggle linear/exponential'], ['Q / Esc', 'quit']],
})

let { pos, $ } = args()
let min = 20, max = 20000
let range = pos.find(t => t.includes('..'))
if (range) { let [a, b] = range.split('..'); if (a) min = num(a); if (b) max = num(b) }
min = min || 20
let mode = pos.find(t => /^[le]/i.test(t)) || $('mode', 'exp')
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '3'))

let ctx = new AudioContext()
await ctx.resume()

let osc, t0
let start = () => {
  if (osc) try { osc.stop() } catch {}
  t0 = ctx.currentTime
  let demo = buildSweep(ctx, { from: min, to: max, mode: mode[0] === 'l' ? 'linear' : 'exponential', duration: dur, gain: 0.5, when: t0 })
  osc = demo.sources[0]
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
