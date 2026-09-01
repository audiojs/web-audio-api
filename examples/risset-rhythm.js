// Risset rhythm — infinitely accelerating or decelerating beat.
// The rhythmic analog of the Shepard tone.
// Run: node examples/risset-rhythm.js up 120 20s
// Run: node examples/risset-rhythm.js dir=down bpm=90 -d 30s
// Keys: q quit

import { AudioContext } from 'web-audio-api'
import { init } from './graphs/risset-rhythm.js'
import { args, sec, keys, clearLine, help } from './utils.js'

help({
  description: 'play an endlessly accelerating or decelerating rhythm illusion',
  usage: ['', '[up|down] [bpm] [duration]', 'dir=down bpm=90 dur=30s'],
  options: [
    ['dir=<up|down>', 'movement direction (default: up)'],
    ['bpm=<number>', 'center tempo (default: 120)'],
    ['-d, --duration <time>', 'run time with optional s/m/h suffix (default: 20s)'],
  ],
  controls: [['Space', 'pause/resume'], ['Q / Esc', 'quit']],
})

let { pos, $ } = args()
let dir = pos.find(t => /^(up|down)$/i.test(t)) || $('dir', 'up')
let bpm = +(pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t)) || $('bpm', 120))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '20'))

let ctx = new AudioContext()
await ctx.resume()
init(ctx, { direction: dir, bpm, duration: dur })

keys({}, () => { clearLine(); ctx.close() }, ctx)
console.log(`Risset rhythm: ${dir}, ~${bpm} BPM center (${dur}s)  space pause · q quit`)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, dur * 1000 + 500)
