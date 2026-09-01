// AudioWorklet: custom processor that generates white noise.
// Run: node examples/worklet.js

import { OfflineAudioContext, AudioWorkletNode } from 'web-audio-api'
import { init } from './graphs/worklet.js'
import { help } from './utils.js'

help({
  description: 'render white noise from a custom AudioWorkletProcessor',
  usage: [''],
  notes: ['Renders one second offline and prints RMS measurements through an automated fade.'],
})

const sr = 44100
const duration = 1
const ctx = new OfflineAudioContext(1, sr * duration, sr)

await init(ctx, { duration, gain: 1, when: 0, AudioWorkletNodeClass: AudioWorkletNode })

let buf = await ctx.startRendering()
let data = buf.getChannelData(0)

// Show amplitude at different points
for (let t of [0, 0.15, 0.5, 0.85, 0.99]) {
  let i = Math.floor(t * sr)
  let block = data.slice(i, i + 256)
  let rms = Math.sqrt(block.reduce((s, v) => s + v * v, 0) / block.length)
  console.log(`t=${t.toFixed(2)}s  RMS=${rms.toFixed(3)}`)
}
