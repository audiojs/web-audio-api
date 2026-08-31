// Stereo test — left, right, center channel identification.
// Run: node examples/stereo-test.js 1k 1s
// Run: node examples/stereo-test.js freq=500 dur=2s

import { AudioContext } from 'web-audio-api'
import { build as buildStereoTest } from './graphs/stereo-test.js'
import { args, num, sec, keys, clearLine, help } from './utils.js'

help({
  description: 'identify the left, right, and center channels',
  usage: ['', '[frequency] [duration-per-channel]', 'freq=500 dur=2s'],
  options: [
    ['freq=<hz|note>', 'test frequency or note name (default: 1k)'],
    ['-d, --duration <time>', 'time per channel with optional s/m/h suffix (default: 1s)'],
  ],
  controls: [['Space', 'pause/resume'], ['Q / Esc', 'quit']],
})

let { pos, $ } = args()
let f = num(pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t) || /^[A-G][#b]?\d$/i.test(t)) || $('freq', 1000))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '1'))

let ctx = new AudioContext()
await ctx.resume()

let tests = ['Left', 'Right', 'Center']
let gap = 0.3
for (let name of tests) console.log(name)
buildStereoTest(ctx, { frequency: f, durationPerChannel: dur, gap, gain: 0.5 })

keys({}, () => { clearLine(); ctx.close() }, ctx)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, tests.length * (dur + gap) * 1000)
