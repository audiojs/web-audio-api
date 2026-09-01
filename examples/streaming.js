// Auditory streaming — an alternating tone pair fuses into one stream or splits into two.
// Run: node examples/streaming.js 240 4 15s
// Run: node examples/streaming.js tempo=240 interval=4 -d 15s
// Keys: q quit

import { AudioContext } from 'web-audio-api'
import { init } from './graphs/streaming.js'
import { args, sec, keys, clearLine, help } from './utils.js'

help({
  description: 'alternate two tones and hear them fuse or split into streams',
  usage: ['', '[tempo] [interval] [duration]', 'tempo=240 interval=4 dur=15s'],
  options: [
    ['tempo=<bpm>', 'note tempo (default: 240)'],
    ['interval=<semitones>', 'pitch interval between the two tones (default: 4)'],
    ['-d, --duration <time>', 'run time with optional s/m/h suffix (default: 15s)'],
  ],
  controls: [['Space', 'pause/resume'], ['Q / Esc', 'quit']],
})

let { pos, $ } = args()
let tempo = +(pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t)) || $('tempo', 240))
let interval = +(pos.filter(t => /^\d/.test(t) && !/[smh]$/.test(t))[1] || $('interval', 4))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '15'))

let ctx = new AudioContext()
await ctx.resume()

init(ctx, { tempo, interval, duration: dur, gain: 0.16 })

keys({}, () => { clearLine(); ctx.close() }, ctx)
console.log(`Auditory streaming: ${tempo}bpm, ${interval} semitones (${dur}s)  space pause · q quit`)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, dur * 1000 + 200)
