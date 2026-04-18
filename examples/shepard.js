// Shepard tone — infinitely rising or falling pitch illusion.
// Run: node examples/shepard.js up 15s
// Run: node examples/shepard.js dir=down rate=0.3 -d 20s
// Keys: space pause · ←/→ ±0.1 oct/s rate · r reverse direction · q quit

import { AudioContext, AudioWorkletNode, AudioWorkletProcessor } from 'web-audio-api'
import { args, sec, keys, status, clearLine, pausedTag } from './_util.js'

let { pos, $ } = args()
let dir = pos.find(t => /^(up|down)$/i.test(t)) || $('dir', 'up')
let rate = +(pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t)) || $('rate', 0.5))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '30'))

let sign = dir === 'down' ? -1 : 1
let ctx = new AudioContext()
await ctx.resume()

await ctx.audioWorklet.addModule(scope => {
  class Shepard extends AudioWorkletProcessor {
    constructor(opts) {
      super()
      let o = opts.processorOptions
      this.sign = o.sign
      this.rate = o.rate
      this.sr = o.sr
      this.nOct = 8; this.sigma = 2; this.fCenter = 440
      this.phases = new Float64Array(this.nOct)
      this.t = 0
      this.port.onmessage = e => {
        if (e.data.sign !== undefined) this.sign = e.data.sign
        if (e.data.rate !== undefined) this.rate = e.data.rate
      }
    }
    process(_, outputs) {
      let out = outputs[0][0]
      let { sign, rate, nOct, sigma, fCenter, sr } = this
      for (let i = 0; i < out.length; i++) {
        this.t += 1 / sr
        let sample = 0
        for (let o = 0; o < nOct; o++) {
          let phase = ((o / nOct + sign * rate / nOct * this.t) % 1 + 1) % 1
          let octOff = phase * nOct - nOct / 2
          let freq = fCenter * (2 ** octOff)
          let amp = Math.exp(-0.5 * (octOff / sigma) ** 2)
          this.phases[o] += freq / sr
          sample += Math.sin(2 * Math.PI * this.phases[o]) * amp
        }
        out[i] = sample * 0.12
      }
      return true
    }
  }
  scope.registerProcessor('shepard', Shepard)
})

let node = new AudioWorkletNode(ctx, 'shepard', { processorOptions: { sign, rate, sr: ctx.sampleRate } })
let master = ctx.createGain()
node.connect(master).connect(ctx.destination)

let render = status()
let ui = setInterval(() => render(`Shepard · ${sign > 0 ? 'up  ' : 'down'} · ${rate.toFixed(2)} oct/s · space pause · ←→ rate · r reverse · q quit${pausedTag(ctx)}`), 80)

keys({
  left: () => { rate = Math.max(0.05, rate - 0.1); node.port.postMessage({ rate }) },
  right: () => { rate += 0.1; node.port.postMessage({ rate }) },
  r: () => { sign = -sign; node.port.postMessage({ sign }) },
}, () => { clearInterval(ui); clearLine(); ctx.close() }, ctx)

console.log(`Shepard tone: ${dir} at ${rate} oct/s (${dur}s)  space pause · ←→ rate · r reverse · q quit`)

let t = ctx.currentTime + dur
let fadeStart = Math.max(ctx.currentTime + 0.01, t - 1)
master.gain.setValueAtTime(1, fadeStart)
master.gain.linearRampToValueAtTime(0, t)
setTimeout(() => { clearInterval(ui); clearLine(); ctx.close(); process.exit(0) }, dur * 1000 + 200)
