// Linked parameters: one ConstantSourceNode controls multiple gains.
// Run: node examples/linked-params.js

import { OfflineAudioContext } from 'web-audio-api'
import { init as buildLinkedParams } from './graphs/linked-params.js'
import { help } from './utils.js'

help({
  description: 'control multiple AudioParams from one ConstantSourceNode',
  usage: [''],
  notes: ['Renders two seconds offline and prints RMS measurements for the shared gain envelope.'],
})

const sr = 44100
const duration = 2
const ctx = new OfflineAudioContext(1, sr * duration, sr)

buildLinkedParams(ctx, { duration, when: 0 })

let buf = await ctx.startRendering()
let data = buf.getChannelData(0)

console.log('Linked params: ConstantSource → 2 GainNodes')
for (let t of [0, 0.25, 0.5, 1.0, 1.5, 1.9]) {
  let i = Math.floor(t * sr)
  let block = data.slice(i, i + 256)
  let rms = Math.sqrt(block.reduce((s, v) => s + v * v, 0) / block.length)
  console.log(`  t=${t.toFixed(1)}s  RMS=${rms.toFixed(3)}`)
}
