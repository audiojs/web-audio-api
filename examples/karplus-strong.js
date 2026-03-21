// Karplus-Strong — plucked string from noise + delay feedback.
// Run: node examples/karplus-strong.js 220 4s
// Run: node examples/karplus-strong.js freq=440 dur=2s

import { AudioContext, AudioWorkletNode, AudioWorkletProcessor } from 'web-audio-api'

let args = process.argv.slice(2), kv = {}, pos = []
for (let s of args) { let e = s.indexOf('='); e > 0 ? kv[s.slice(0, e)] = s.slice(e + 1) : pos.push(s) }
let $ = (k, d) => { for (let p in kv) if (k.startsWith(p) || p.startsWith(k)) return kv[p]; return d }
let semi = 'C.D.EF.G.A.B'
let num = v => { v += ''; let m = v.match(/^([A-G])([#b])?(\d)$/i); return m ? 440 * 2 ** ((semi.indexOf(m[1].toUpperCase()) + (m[2]==='#') - (m[2]==='b') + 12*(+m[3]+1) - 69) / 12) : parseFloat(v) * (/k$/i.test(v) ? 1e3 : 1) }
let sec = v => (v += '', parseFloat(v) * ({s:1,m:60,h:3600}[v.slice(-1)] || 1))

let f = num(pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t) || /^[A-G][#b]?\d$/i.test(t)) || $('freq', 220))
let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '4'))

let ctx = new AudioContext()
await ctx.resume()

await ctx.audioWorklet.addModule(scope => {
  class KS extends AudioWorkletProcessor {
    constructor(opts) {
      super()
      let { freq, sr } = opts.processorOptions
      this.len = Math.round(sr / freq)
      this.buf = new Float32Array(this.len)
      for (let i = 0; i < this.len; i++) this.buf[i] = Math.random() * 2 - 1
      this.pos = 0
    }
    process(_, outputs) {
      let out = outputs[0][0], b = this.buf, len = this.len
      for (let i = 0; i < out.length; i++) {
        let next = (this.pos + 1) % len
        // Average adjacent samples — lowpass filter creates natural string decay
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

console.log(`Karplus-Strong pluck @ ${f}Hz`)
setTimeout(() => ctx.close(), dur * 1000)
