// Reference tone — the A440 of audio testing.
// Run: node examples/tone.js sine 440 2s
// Run: node examples/tone.js wave=triangle freq=1k -d 5s
// Keys: ↑/↓ ±semitone · ←/→ cycle waveform · q quit

import { AudioContext } from 'web-audio-api'
import { args, num, sec, keys, status, clearLine, noteName, pausedTag, help } from './_util.js'

help({
  description: 'play a reference tone',
  usage: ['', '[wave] [frequency] [duration]', 'wave=triangle freq=1k dur=5s'],
  options: [
    ['wave=<type>', 'sine (default), triangle, square, or sawtooth'],
    ['freq=<hz|note>', 'frequency or note name such as 440, 1k, A4, or C#3 (default: 440)'],
    ['-d, --duration <time>', 'run time with optional s/m/h suffix (default: 30s)'],
  ],
  controls: [['Space', 'pause/resume'], ['↑ / ↓', 'move one semitone'], ['← / →', 'cycle waveform'], ['Q / Esc', 'quit']],
})

let { pos, $ } = args()
let waves = ['sine', 'triangle', 'square', 'sawtooth']
let wave = pos.find(t => waves.includes(t)) || $('wave', 'sine')
let wIdx = waves.indexOf(wave); if (wIdx < 0) wIdx = 0
let f = num(pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t) || /^[A-G][#b]?\d$/i.test(t)) || $('freq', 440))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '30'))

let ctx = new AudioContext()
await ctx.resume()

let osc = ctx.createOscillator()
osc.type = waves[wIdx]
osc.frequency.value = f

let master = ctx.createGain()
master.gain.value = 0.3
osc.connect(master).connect(ctx.destination)
osc.start()

let render = status()
let ui = setInterval(() => render(`${waves[wIdx].padEnd(9)} ${f.toFixed(2).padStart(8)}Hz ${noteName(f).padEnd(4)} · space pause · ↑↓ semi · ←→ wave · q quit${pausedTag(ctx)}`), 80)

keys({
  up: () => { f *= 2 ** (1/12); osc.frequency.setTargetAtTime(f, ctx.currentTime, 0.02) },
  down: () => { f *= 2 ** (-1/12); osc.frequency.setTargetAtTime(f, ctx.currentTime, 0.02) },
  right: () => { wIdx = (wIdx + 1) % waves.length; osc.type = waves[wIdx] },
  left: () => { wIdx = (wIdx - 1 + waves.length) % waves.length; osc.type = waves[wIdx] },
}, () => { clearInterval(ui); clearLine(); ctx.close() }, ctx)

let t = ctx.currentTime + dur
master.gain.setValueAtTime(0.3, t - 0.05)
master.gain.linearRampToValueAtTime(0, t)
setTimeout(() => { clearInterval(ui); clearLine(); ctx.close(); process.exit(0) }, dur * 1000)
