// Wavetable synth — crossfade custom Fourier wavetables built with createPeriodicWave.
// Run: node examples/wavetable.js organ 220 0.3 6s
// Run: node examples/wavetable.js preset=bell freq=220 morph=0.5 -d 6s
// Keys: q quit

import { AudioContext } from 'web-audio-api'
import { init } from './graphs/wavetable.js'
import { args, num, sec, keys, clearLine, help } from './utils.js'

help({
  description: 'crossfade custom PeriodicWave tables between two oscillators',
  usage: ['', '[preset] [frequency] [morph] [duration]', 'preset=bell freq=220 morph=0.5 dur=6s'],
  options: [
    ['preset=<name>', 'organ, bell, pulse, or voice (default: organ)'],
    ['freq=<hz|note>', 'fundamental frequency (default: 220)'],
    ['morph=<0..1>', 'crossfade toward the next preset (default: 0.3)'],
    ['-d, --duration <time>', 'run time with optional s/m/h suffix (default: 6s)'],
  ],
  controls: [['Space', 'pause/resume'], ['Q / Esc', 'quit']],
})

let presets = ['organ', 'bell', 'pulse', 'voice']
let { pos, $ } = args()
let preset = (pos.find(t => presets.includes(t.toLowerCase())) || $('preset', 'organ')).toLowerCase()
let nums = pos.filter(t => /^\d/.test(t) && !/[smh]$/.test(t) || /^[A-G][#b]?\d$/i.test(t))
let freq = num(nums[0] || $('freq', 220))
let morph = +(nums[1] || $('morph', 0.3))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '6'))

let ctx = new AudioContext()
await ctx.resume()

init(ctx, { preset, frequency: freq, morph, duration: dur, gain: 0.2 })

keys({}, () => { clearLine(); ctx.close() }, ctx)
console.log(`Wavetable: ${preset} @ ${freq}Hz, morph ${morph} (${dur}s)  space pause · q quit`)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, dur * 1000 + 200)
