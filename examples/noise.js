// Colored noise — white, pink, brown, blue, violet.
// Run: node examples/noise.js pink 2s
// Run: node examples/noise.js color=brown dur=5s

import { AudioContext, AudioWorkletNode, AudioWorkletProcessor } from 'web-audio-api'

let args = process.argv.slice(2), kv = {}, pos = []
for (let s of args) { let e = s.indexOf('='); e > 0 ? kv[s.slice(0, e)] = s.slice(e + 1) : pos.push(s) }
let $ = (k, d) => { for (let p in kv) if (k.startsWith(p) || p.startsWith(k)) return kv[p]; return d }
let sec = v => (v += '', parseFloat(v) * ({s:1,m:60,h:3600}[v.slice(-1)] || 1))

let color = pos.find(t => /^[a-z]/i.test(t)) || $('color', 'white')
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '2'))

let ctx = new AudioContext()
await ctx.resume()

await ctx.audioWorklet.addModule(scope => {
  class Noise extends AudioWorkletProcessor {
    constructor(opts) {
      super()
      this.color = opts.processorOptions?.color || 'white'
      this.b = new Float64Array(7) // pink noise filter state
      this.brown = 0
      this.prev = [0, 0]
    }
    process(_, outputs) {
      let out = outputs[0][0], b = this.b
      for (let i = 0; i < out.length; i++) {
        let w = Math.random() * 2 - 1
        switch (this.color) {
          case 'white': out[i] = w; break
          case 'pink': // Paul Kellet's filter
            b[0] = 0.99886 * b[0] + w * 0.0555179
            b[1] = 0.99332 * b[1] + w * 0.0750759
            b[2] = 0.96900 * b[2] + w * 0.1538520
            b[3] = 0.86650 * b[3] + w * 0.3104856
            b[4] = 0.55000 * b[4] + w * 0.5329522
            b[5] = -0.7616 * b[5] - w * 0.0168980
            out[i] = (b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b[6] + w * 0.5362) * 0.11
            b[6] = w * 0.115926
            break
          case 'brown': // integrated white noise
            this.brown = (this.brown + 0.02 * w) / 1.02
            out[i] = this.brown * 3.5
            break
          case 'blue': // differentiated white noise
            out[i] = w - this.prev[0]
            this.prev[0] = w
            break
          case 'violet': // double-differentiated white noise
            out[i] = w - 2 * this.prev[0] + this.prev[1]
            this.prev[1] = this.prev[0]
            this.prev[0] = w
            break
        }
      }
      return true
    }
  }
  scope.registerProcessor('noise', Noise)
})

let noise = new AudioWorkletNode(ctx, 'noise', { processorOptions: { color } })

let master = ctx.createGain()
master.gain.value = 0.5
noise.connect(master).connect(ctx.destination)

let t = ctx.currentTime + dur
master.gain.setValueAtTime(0.5, t - 0.05)
master.gain.linearRampToValueAtTime(0, t)
setTimeout(() => ctx.close(), dur * 1000)
