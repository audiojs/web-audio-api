// Dirac impulse — single-sample click for impulse response testing.
// Run: node examples/impulse.js 5 0.5s
// Run: node examples/impulse.js count=3 interval=1s
// Keys: space pause · f fire impulse · q quit

import { AudioContext } from 'web-audio-api'
import { args, sec, keys, clearLine } from './_util.js'

let { pos, $ } = args()
let nums = pos.filter(t => /^\d/.test(t))
let count = +(nums[0] || $('count', 1))
let interval = sec(nums[1] || $('interval', '0.5'))

let ctx = new AudioContext()
await ctx.resume()

let buf = ctx.createBuffer(1, 1, ctx.sampleRate)
buf.getChannelData(0)[0] = 1

let fire = () => {
  let src = ctx.createBufferSource()
  src.buffer = buf
  src.connect(ctx.destination)
  src.start()
}

let t = ctx.currentTime
for (let i = 0; i < count; i++) {
  let src = ctx.createBufferSource()
  src.buffer = buf
  src.connect(ctx.destination)
  src.start(t + i * interval)
}

keys({ f: fire }, () => { clearLine(); ctx.close() }, ctx)
console.log(`${count} impulse(s), ${interval}s interval  space pause · f fire · q quit`)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, ((count - 1) * interval + 0.5) * 1000)
