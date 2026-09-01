// Karplus-Strong — plucked string from noise + delay feedback.
// Run: node examples/karplus-strong.js 220 4s
// Run: node examples/karplus-strong.js freq=440 -d 2s
// Keys: space pause · p pluck · ↑/↓ ±semitone · q quit

import { AudioContext, AudioWorkletNode } from 'web-audio-api'
import { init } from './graphs/karplus-strong.js'
import { args, num, sec, keys, status, clearLine, noteName, pausedTag, help } from './utils.js'

help({
  description: 'synthesize a plucked string from noise and feedback',
  usage: ['', '[frequency] [duration]', 'freq=A4 dur=2s'],
  options: [
    ['freq=<hz|note>', 'string frequency (default: 220)'],
    ['-d, --duration <time>', 'run time with optional s/m/h suffix (default: 30s)'],
  ],
  controls: [['Space', 'pause/resume'], ['P', 'pluck again'], ['↑ / ↓', 'move one semitone and pluck'], ['Q / Esc', 'quit']],
})

let { pos, $ } = args()
let f = num(pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t) || /^[A-G][#b]?\d$/i.test(t)) || $('freq', 220))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '30'))

let ctx = new AudioContext()
await ctx.resume()

let demo = await init(ctx, { frequency: f, duration: dur, AudioWorkletNodeClass: AudioWorkletNode })
let node = demo.data.node

let render = status()
let ui = setInterval(() => render(`Karplus-Strong · ${f.toFixed(1)}Hz ${noteName(f)} · space pause · p pluck · ↑↓ semi · q quit${pausedTag(ctx)}`), 80)

keys({
  p: () => node.port.postMessage({ frequency: f }),
  up: () => { f *= 2 ** (1/12); node.port.postMessage({ frequency: f }) },
  down: () => { f *= 2 ** (-1/12); node.port.postMessage({ frequency: f }) },
}, () => { clearInterval(ui); clearLine(); ctx.close() }, ctx)

console.log(`Karplus-Strong pluck @ ${f}Hz ${noteName(f)} (${dur}s)  space pause · p pluck · ↑↓ semi · q quit`)
setTimeout(() => { clearInterval(ui); clearLine(); ctx.close(); process.exit(0) }, dur * 1000)
