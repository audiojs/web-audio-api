// Colored noise — white, pink, brown, blue, violet.
// Run: node examples/noise.js pink 2s
// Run: node examples/noise.js color=brown -d 5s
// Keys: ↑/↓ cycle color · q quit

import { AudioContext } from 'web-audio-api'
import { build } from './graphs/noise.js'
import { args, sec, keys, status, clearLine, pausedTag, help } from './utils.js'

help({
  description: 'listen to colored noise',
  usage: ['', '[color] [duration]', 'color=brown dur=5s'],
  options: [
    ['color=<type>', 'white (default), pink, brown, blue, or violet'],
    ['-d, --duration <time>', 'run time with optional s/m/h suffix (default: 30s)'],
  ],
  controls: [['Space', 'pause/resume'], ['↑ / ↓', 'cycle color'], ['Q / Esc', 'quit']],
})

let { pos, $ } = args()
let colors = ['white', 'pink', 'brown', 'blue', 'violet']
let color = pos.find(t => colors.includes(t)) || $('color', 'white')
let cIdx = colors.indexOf(color); if (cIdx < 0) cIdx = 0
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '30'))

let ctx = new AudioContext()
await ctx.resume()

let demo
let play = () => {
  for (let source of demo?.sources || []) { try { source.stop(ctx.currentTime) } catch {} }
  for (let node of demo?.nodes || []) { try { node.disconnect() } catch {} }
  demo = build(ctx, { color: colors[cIdx], duration: dur, gain: 0.5, seed: Math.random() * 0xffffffff })
}
play()

let render = status()
let ui = setInterval(() => render(`noise · ${colors[cIdx].padEnd(7)} · space pause · ↑↓ color · q quit${pausedTag(ctx)}`), 80)

keys({
  up: () => { cIdx = (cIdx + 1) % colors.length; play() },
  down: () => { cIdx = (cIdx - 1 + colors.length) % colors.length; play() },
}, () => { clearInterval(ui); clearLine(); ctx.close() }, ctx)

setTimeout(() => { clearInterval(ui); clearLine(); ctx.close(); process.exit(0) }, dur * 1000)
