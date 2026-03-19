// Linked parameters: one ConstantSourceNode controls multiple gains.
// Run: node examples/linked-params.js

import { OfflineAudioContext } from 'web-audio-api'

const sr = 44100
const duration = 2
const ctx = new OfflineAudioContext(1, sr * duration, sr)

// Two oscillators at different frequencies
let osc1 = ctx.createOscillator()
osc1.frequency.value = 440

let osc2 = ctx.createOscillator()
osc2.frequency.value = 660

// Individual gain nodes
let gain1 = ctx.createGain()
gain1.gain.value = 0

let gain2 = ctx.createGain()
gain2.gain.value = 0

// Master control: one ConstantSourceNode drives both gains
let master = ctx.createConstantSource()
master.offset.setValueAtTime(0, 0)
master.offset.linearRampToValueAtTime(0.5, 0.5)     // fade in
master.offset.setValueAtTime(0.5, 1.5)
master.offset.linearRampToValueAtTime(0, duration)   // fade out

// Connect master to both gain params
master.connect(gain1.gain)
master.connect(gain2.gain)

// Mix to output
let mixer = ctx.createGain()
mixer.gain.value = 0.5

osc1.connect(gain1).connect(mixer)
osc2.connect(gain2).connect(mixer)
mixer.connect(ctx.destination)

osc1.start()
osc2.start()
master.start()

let buf = await ctx.startRendering()
let data = buf.getChannelData(0)

console.log('Linked params: ConstantSource → 2 GainNodes')
for (let t of [0, 0.25, 0.5, 1.0, 1.5, 1.9]) {
  let i = Math.floor(t * sr)
  let block = data.slice(i, i + 256)
  let rms = Math.sqrt(block.reduce((s, v) => s + v * v, 0) / block.length)
  console.log(`  t=${t.toFixed(1)}s  RMS=${rms.toFixed(3)}`)
}
