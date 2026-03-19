// AudioWorklet: custom processor that generates white noise.
// Run: node examples/worklet.js

import { OfflineAudioContext, AudioWorkletNode, AudioWorkletProcessor } from 'web-audio-api'

const sr = 44100
const duration = 1
const ctx = new OfflineAudioContext(1, sr * duration, sr)

// Register processor using inline function (no separate file needed)
await ctx.audioWorklet.addModule(scope => {
  class WhiteNoise extends AudioWorkletProcessor {
    static get parameterDescriptors() {
      return [{ name: 'amplitude', defaultValue: 0.5, minValue: 0, maxValue: 1 }]
    }

    process(inputs, outputs, parameters) {
      let output = outputs[0][0]
      let amp = parameters.amplitude
      let isConstant = amp.length === 1

      for (let i = 0; i < output.length; i++) {
        let a = isConstant ? amp[0] : amp[i]
        output[i] = (Math.random() * 2 - 1) * a
      }
      return true
    }
  }
  scope.registerProcessor('white-noise', WhiteNoise)
})

let noise = new AudioWorkletNode(ctx, 'white-noise')
// Automate amplitude: fade in then out
let amp = noise.parameters.get('amplitude')
amp.setValueAtTime(0, 0)
amp.linearRampToValueAtTime(1, 0.3)
amp.setValueAtTime(1, 0.7)
amp.linearRampToValueAtTime(0, 1)

noise.connect(ctx.destination)

let buf = await ctx.startRendering()
let data = buf.getChannelData(0)

// Show amplitude at different points
for (let t of [0, 0.15, 0.5, 0.85, 0.99]) {
  let i = Math.floor(t * sr)
  let block = data.slice(i, i + 256)
  let rms = Math.sqrt(block.reduce((s, v) => s + v * v, 0) / block.length)
  console.log(`t=${t.toFixed(2)}s  RMS=${rms.toFixed(3)}`)
}
