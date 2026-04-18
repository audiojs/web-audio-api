// Risset rhythm — infinitely accelerating or decelerating beat.
// The rhythmic analog of the Shepard tone.
// Run: node examples/risset-rhythm.js up 120 20s
// Run: node examples/risset-rhythm.js dir=down bpm=90 -d 30s
// Keys: q quit

import { AudioContext } from 'web-audio-api'
import { args, sec, keys, clearLine } from './_util.js'

let { pos, $ } = args()
let dir = pos.find(t => /^(up|down)$/i.test(t)) || $('dir', 'up')
let bpm = +(pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t)) || $('bpm', 120))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '20'))

let sign = dir === 'down' ? -1 : 1
let ctx = new AudioContext()
await ctx.resume()

let nVoices = 6, period = 10, sigma = 0.35

let click = (when, amp) => {
  if (amp < 0.01) return
  let osc = ctx.createOscillator()
  osc.frequency.setValueAtTime(1200, when)
  osc.frequency.exponentialRampToValueAtTime(400, when + 0.01)
  let env = ctx.createGain()
  env.gain.setValueAtTime(amp * 0.5, when)
  env.gain.exponentialRampToValueAtTime(0.001, when + 0.04)
  osc.connect(env).connect(ctx.destination)
  osc.start(when); osc.stop(when + 0.06)
}

let t0 = ctx.currentTime
for (let v = 0; v < nVoices; v++) {
  let offset = v / nVoices
  let t = 0
  while (t < dur) {
    let phase = ((t / period * sign + offset) % 1 + 1) % 1
    let tempo = bpm * (2 ** phase)
    let amp = Math.exp(-0.5 * ((phase - 0.5) / sigma) ** 2)
    click(t0 + t, amp)
    t += 60 / tempo
  }
}

keys({}, () => { clearLine(); ctx.close() }, ctx)
console.log(`Risset rhythm: ${dir}, ~${bpm} BPM center (${dur}s)  space pause · q quit`)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, dur * 1000 + 500)
