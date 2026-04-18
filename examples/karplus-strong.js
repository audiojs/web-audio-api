// Karplus-Strong — plucked string from noise + delay feedback.
// Run: node examples/karplus-strong.js 220 4s
// Run: node examples/karplus-strong.js freq=440 -d 2s
// Keys: space pause · p pluck · ↑/↓ ±semitone · q quit

import { AudioContext, AudioWorkletNode, AudioWorkletProcessor } from 'web-audio-api'
import { args, num, sec, keys, status, clearLine, noteName, pausedTag } from './_util.js'

let { pos, $ } = args()
let f = num(pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t) || /^[A-G][#b]?\d$/i.test(t)) || $('freq', 220))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '30'))

let ctx = new AudioContext()
await ctx.resume()

await ctx.audioWorklet.addModule(scope => {
  class KS extends AudioWorkletProcessor {
    constructor(opts) {
      super()
      let { freq, sr } = opts.processorOptions
      this.sr = sr
      this.setFreq(freq)
      this.pos = 0
      this.port.onmessage = e => {
        if (e.data.pluck !== undefined) {
          this.setFreq(e.data.pluck)
          this.pos = 0
        }
      }
    }
    setFreq(freq) {
      this.len = Math.round(this.sr / freq)
      this.buf = new Float32Array(this.len)
      for (let i = 0; i < this.len; i++) this.buf[i] = Math.random() * 2 - 1
    }
    process(_, outputs) {
      let out = outputs[0][0], b = this.buf, len = this.len
      for (let i = 0; i < out.length; i++) {
        let next = (this.pos + 1) % len
        b[this.pos] = (b[this.pos] + b[next]) * 0.498
        out[i] = b[this.pos]
        this.pos = next
      }
      return true
    }
  }
  scope.registerProcessor('ks', KS)
})

let ks = new AudioWorkletNode(ctx, 'ks', { processorOptions: { freq: f, sr: ctx.sampleRate } })
let master = ctx.createGain()
master.gain.value = 0.5
ks.connect(master).connect(ctx.destination)

let render = status()
let ui = setInterval(() => render(`Karplus-Strong · ${f.toFixed(1)}Hz ${noteName(f)} · space pause · p pluck · ↑↓ semi · q quit${pausedTag(ctx)}`), 80)

keys({
  p: () => ks.port.postMessage({ pluck: f }),
  up: () => { f *= 2 ** (1/12); ks.port.postMessage({ pluck: f }) },
  down: () => { f *= 2 ** (-1/12); ks.port.postMessage({ pluck: f }) },
}, () => { clearInterval(ui); clearLine(); ctx.close() }, ctx)

console.log(`Karplus-Strong pluck @ ${f}Hz ${noteName(f)} (${dur}s)  space pause · p pluck · ↑↓ semi · q quit`)
setTimeout(() => { clearInterval(ui); clearLine(); ctx.close(); process.exit(0) }, dur * 1000)
