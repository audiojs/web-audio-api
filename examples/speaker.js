// Hello world — play a 440Hz tone for 2 seconds.
// Run: node examples/speaker.js
// Run: node examples/speaker.js -d 5s
// Keys: q quit

import { AudioContext } from 'web-audio-api'
import { args, sec, keys, clearLine, help } from './_util.js'

help({
  description: 'play the minimal Web Audio “hello world” tone',
  usage: ['', '-d 5s'],
  options: [['-d, --duration <time>', 'run time with optional s/m/h suffix (default: 2s)']],
  controls: [['Space', 'pause/resume'], ['Q / Esc', 'quit']],
})

let { $ } = args()
let duration = sec($('dur', '2'))

const ctx = new AudioContext()
await ctx.resume()

const osc = ctx.createOscillator()
osc.frequency.value = 440

const master = ctx.createGain()
osc.connect(master).connect(ctx.destination)
osc.start()

let t = ctx.currentTime + duration
master.gain.setValueAtTime(1, t - 0.05)
master.gain.linearRampToValueAtTime(0, t)

keys({}, () => { clearLine(); ctx.close() }, ctx)
console.log(`440Hz (${duration}s)  space pause · q quit`)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, duration * 1000)
