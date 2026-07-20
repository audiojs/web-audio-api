// Render audio offline to a buffer — no speakers, no I/O.
// Run: node examples/render-to-buffer.js

import { OfflineAudioContext } from 'web-audio-api'
import { help } from './_util.js'

help({
  description: 'render audio offline into an AudioBuffer',
  usage: [''],
  notes: ['Renders a two-second stereo 440 Hz tone and prints buffer metadata and samples.'],
})

const sr = 44100
const ctx = new OfflineAudioContext(2, sr * 2, sr) // 2 seconds, stereo

const osc = ctx.createOscillator()
osc.frequency.value = 440
osc.connect(ctx.destination)
osc.start()
osc.stop(2)

const buffer = await ctx.startRendering()

console.log('Channels:', buffer.numberOfChannels)
console.log('Length:', buffer.length, 'samples')
console.log('Duration:', buffer.duration, 'seconds')
console.log('First 8 samples:', Array.from(buffer.getChannelData(0).slice(0, 8), v => v.toFixed(4)))
