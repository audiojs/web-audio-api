// Dirac impulse — single-sample click for impulse response testing.
// Run: node examples/impulse.js 5 0.5s
// Run: node examples/impulse.js count=3 interval=1s

import { AudioContext } from 'web-audio-api'

let args = process.argv.slice(2), kv = {}, pos = []
for (let s of args) { let e = s.indexOf('='); e > 0 ? kv[s.slice(0, e)] = s.slice(e + 1) : pos.push(s) }
let $ = (k, d) => { for (let p in kv) if (k.startsWith(p) || p.startsWith(k)) return kv[p]; return d }
let sec = v => (v += '', parseFloat(v) * ({s:1,m:60,h:3600}[v.slice(-1)] || 1))

let nums = pos.filter(t => /^\d/.test(t))
let count = +(nums[0] || $('count', 1))
let interval = sec(nums[1] || $('interval', '0.5'))

let ctx = new AudioContext()
await ctx.resume()

let buf = ctx.createBuffer(1, 1, ctx.sampleRate)
buf.getChannelData(0)[0] = 1

let t = ctx.currentTime
for (let i = 0; i < count; i++) {
  let src = ctx.createBufferSource()
  src.buffer = buf
  src.connect(ctx.destination)
  src.start(t + i * interval)
}

setTimeout(() => ctx.close(), ((count - 1) * interval + 0.5) * 1000)
