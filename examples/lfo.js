// LFO tremolo: sine carrier modulated by a low-frequency oscillator.
// Run: node examples/lfo.js
// Run: node examples/lfo.js rate=5 depth=0.5 -d 10s
// Keys: ←/→ ±0.5 Hz rate · ↑/↓ ±0.05 depth · w cycle LFO wave · q quit

import { AudioContext } from 'web-audio-api'
import { init as buildTremolo } from './graphs/lfo.js'
import { args, sec, keys, status, clearLine, pausedTag, help } from './utils.js'

help({
  description: 'modulate a 440 Hz carrier with an LFO tremolo',
  usage: ['', 'rate=5 depth=0.5 wave=square dur=10s'],
  options: [
    ['rate=<hz>', 'LFO frequency (default: 5)'],
    ['depth=<0..1>', 'tremolo depth (default: 0.5)'],
    ['wave=<type>', 'sine, square (default), triangle, or sawtooth'],
    ['-d, --duration <time>', 'run time with optional s/m/h suffix (default: 30s)'],
  ],
  controls: [
    ['Space', 'pause/resume'], ['← / →', 'change rate by 0.5 Hz'], ['↑ / ↓', 'change depth by 0.05'],
    ['W', 'cycle LFO waveform'], ['Q / Esc', 'quit'],
  ],
})

let { $ } = args()
let dur = sec($('dur', '30'))
let rate = +$('rate', 5)
let depth = +$('depth', 0.5)
let waves = ['sine', 'square', 'triangle', 'sawtooth']
let wIdx = waves.indexOf($('wave', 'square')); if (wIdx < 0) wIdx = 1

let ctx = new AudioContext()
await ctx.resume()

let demo = buildTremolo(ctx, { carrier: 440, rate, depth, waveform: waves[wIdx], duration: dur, gain: 0.3 })
let [, lfo, lfoGain, offset] = demo.nodes

let apply = () => {
  let t = ctx.currentTime
  lfo.frequency.setTargetAtTime(rate, t, 0.02)
  lfoGain.gain.setTargetAtTime(depth, t, 0.02)
  offset.offset.setTargetAtTime(1 - depth, t, 0.02)
}

let render = status()
let ui = setInterval(() => render(`carrier 440Hz · LFO ${waves[wIdx].padEnd(9)} ${rate.toFixed(2)}Hz · depth ${depth.toFixed(2)} · space pause · ←→ rate · ↑↓ depth · w wave · q quit${pausedTag(ctx)}`), 80)

keys({
  left: () => { rate = Math.max(0.1, rate - 0.5); apply() },
  right: () => { rate += 0.5; apply() },
  up: () => { depth = Math.min(1, depth + 0.05); apply() },
  down: () => { depth = Math.max(0, depth - 0.05); apply() },
  w: () => { wIdx = (wIdx + 1) % waves.length; lfo.type = waves[wIdx] },
}, () => { clearInterval(ui); clearLine(); ctx.close() }, ctx)

setTimeout(() => { clearInterval(ui); clearLine(); ctx.close(); process.exit(0) }, dur * 1000)
