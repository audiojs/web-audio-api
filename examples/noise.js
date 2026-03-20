// Filtered noise — white noise through a bandpass filter.
// Run: node examples/noise.js

import { AudioContext, AudioWorkletNode, AudioWorkletProcessor } from 'web-audio-api'

const duration = 2
const ctx = new AudioContext()
await ctx.resume()

await ctx.audioWorklet.addModule(scope => {
  class NoiseProcessor extends AudioWorkletProcessor {
    process(inputs, outputs) {
      let out = outputs[0][0]
      for (let i = 0; i < out.length; i++)
        out[i] = Math.random() * 2 - 1
      return true
    }
  }
  scope.registerProcessor('noise', NoiseProcessor)
})

let noise = new AudioWorkletNode(ctx, 'noise')

let bp = ctx.createBiquadFilter()
bp.type = 'bandpass'
bp.frequency.value = 1000
bp.Q.value = 5

let master = ctx.createGain()
master.gain.value = 0.5

noise.connect(bp).connect(master).connect(ctx.destination)

let t = ctx.currentTime + duration
master.gain.setValueAtTime(0.5, t - 0.05)
master.gain.linearRampToValueAtTime(0, t)
setTimeout(() => ctx.close(), duration * 1000)
