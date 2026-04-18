// Colored noise — white, pink, brown, blue, violet.
// Run: node examples/noise.js pink 2s
// Run: node examples/noise.js color=brown -d 5s
// Keys: ↑/↓ cycle color · q quit

import { AudioContext, AudioWorkletNode, AudioWorkletProcessor } from 'web-audio-api'
import { args, sec, keys, status, clearLine, pausedTag } from './_util.js'

let { pos, $ } = args()
let colors = ['white', 'pink', 'brown', 'blue', 'violet']
let color = pos.find(t => colors.includes(t)) || $('color', 'white')
let cIdx = colors.indexOf(color); if (cIdx < 0) cIdx = 0
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '30'))

let ctx = new AudioContext()
await ctx.resume()

await ctx.audioWorklet.addModule(scope => {
  class Noise extends AudioWorkletProcessor {
    constructor(opts) {
      super()
      this.color = opts.processorOptions?.color || 'white'
      this.b = new Float64Array(7)
      this.brown = 0
      this.prev = [0, 0]
      this.port.onmessage = e => { this.color = e.data }
    }
    process(_, outputs) {
      let out = outputs[0][0], b = this.b
      for (let i = 0; i < out.length; i++) {
        let w = Math.random() * 2 - 1
        switch (this.color) {
          case 'white': out[i] = w; break
          case 'pink':
            b[0] = 0.99886 * b[0] + w * 0.0555179
            b[1] = 0.99332 * b[1] + w * 0.0750759
            b[2] = 0.96900 * b[2] + w * 0.1538520
            b[3] = 0.86650 * b[3] + w * 0.3104856
            b[4] = 0.55000 * b[4] + w * 0.5329522
            b[5] = -0.7616 * b[5] - w * 0.0168980
            out[i] = (b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b[6] + w * 0.5362) * 0.11
            b[6] = w * 0.115926
            break
          case 'brown':
            this.brown = (this.brown + 0.02 * w) / 1.02
            out[i] = this.brown * 3.5
            break
          case 'blue':
            out[i] = w - this.prev[0]
            this.prev[0] = w
            break
          case 'violet':
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

let noise = new AudioWorkletNode(ctx, 'noise', { processorOptions: { color: colors[cIdx] } })
let master = ctx.createGain()
master.gain.value = 0.5
noise.connect(master).connect(ctx.destination)

let render = status()
let ui = setInterval(() => render(`noise · ${colors[cIdx].padEnd(7)} · space pause · ↑↓ color · q quit${pausedTag(ctx)}`), 80)

keys({
  up: () => { cIdx = (cIdx + 1) % colors.length; noise.port.postMessage(colors[cIdx]) },
  down: () => { cIdx = (cIdx - 1 + colors.length) % colors.length; noise.port.postMessage(colors[cIdx]) },
}, () => { clearInterval(ui); clearLine(); ctx.close() }, ctx)

let t = ctx.currentTime + dur
master.gain.setValueAtTime(0.5, t - 0.05)
master.gain.linearRampToValueAtTime(0, t)
setTimeout(() => { clearInterval(ui); clearLine(); ctx.close(); process.exit(0) }, dur * 1000)
