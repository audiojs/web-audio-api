// Shepard tone — infinitely rising or falling pitch illusion.
// Run: node examples/shepard.js up 15s
// Run: node examples/shepard.js dir=down rate=0.3 dur=20s

import { AudioContext, AudioWorkletNode, AudioWorkletProcessor } from 'web-audio-api'

let args = process.argv.slice(2), kv = {}, pos = []
for (let s of args) { let e = s.indexOf('='); e > 0 ? kv[s.slice(0, e)] = s.slice(e + 1) : pos.push(s) }
let $ = (k, d) => { for (let p in kv) if (k.startsWith(p) || p.startsWith(k)) return kv[p]; return d }
let sec = v => (v += '', parseFloat(v) * ({s:1,m:60,h:3600}[v.slice(-1)] || 1))

let dir = pos.find(t => /^(up|down)$/i.test(t)) || $('dir', 'up')
let rate = +(pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t)) || $('rate', 0.5))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '15'))

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
      this.nOct = 8
      this.sigma = 2
      this.fCenter = 440
      this.phases = new Float64Array(this.nOct)
      this.t = 0
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

let node = new AudioWorkletNode(ctx, 'shepard', {
  processorOptions: { sign, rate, sr: ctx.sampleRate }
})
let master = ctx.createGain()
node.connect(master).connect(ctx.destination)

console.log(`Shepard tone: ${dir} at ${rate} oct/s (${dur}s)`)

let t = ctx.currentTime + dur
master.gain.setValueAtTime(1, t - 1)
master.gain.linearRampToValueAtTime(0, t)
setTimeout(() => ctx.close(), dur * 1000 + 200)
