// Shepard tone — infinitely rising or falling pitch illusion.
// Run: node examples/shepard.js up 15s
// Run: node examples/shepard.js dir=down rate=0.3 -d 20s
// Keys: space pause · ←/→ ±0.1 oct/s rate · r reverse direction · q quit

import { AudioContext, AudioWorkletNode } from 'web-audio-api'
import { build } from './graphs/shepard.js'
import { args, sec, keys, status, clearLine, pausedTag, help } from './utils.js'

help({
  description: 'play an endlessly rising or falling pitch illusion',
  usage: ['', '[up|down] [rate] [duration]', 'dir=down rate=0.3 dur=20s'],
  options: [
    ['dir=<up|down>', 'movement direction (default: up)'],
    ['rate=<octaves/s>', 'movement speed (default: 0.5)'],
    ['-d, --duration <time>', 'run time with optional s/m/h suffix (default: 30s)'],
  ],
  controls: [['Space', 'pause/resume'], ['← / →', 'change rate by 0.1 oct/s'], ['R', 'reverse direction'], ['Q / Esc', 'quit']],
})

let { pos, $ } = args()
let dir = pos.find(t => /^(up|down)$/i.test(t)) || $('dir', 'up')
let rate = +(pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t)) || $('rate', 0.5))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '30'))

let sign = dir === 'down' ? -1 : 1
let ctx = new AudioContext()
await ctx.resume()

let demo = await build(ctx, { direction: dir, rate, duration: dur, AudioWorkletNodeClass: AudioWorkletNode })
let node = demo.data.node

let render = status()
let ui = setInterval(() => render(`Shepard · ${sign > 0 ? 'up  ' : 'down'} · ${rate.toFixed(2)} oct/s · space pause · ←→ rate · r reverse · q quit${pausedTag(ctx)}`), 80)

keys({
  left: () => { rate = Math.max(0.05, rate - 0.1); node.port.postMessage({ rate }) },
  right: () => { rate += 0.1; node.port.postMessage({ rate }) },
  r: () => { sign = -sign; node.port.postMessage({ direction: sign > 0 ? 'up' : 'down' }) },
}, () => { clearInterval(ui); clearLine(); ctx.close() }, ctx)

console.log(`Shepard tone: ${dir} at ${rate} oct/s (${dur}s)  space pause · ←→ rate · r reverse · q quit`)

setTimeout(() => { clearInterval(ui); clearLine(); ctx.close(); process.exit(0) }, dur * 1000 + 200)
