// Read an audio file, apply EQ + compression, render to buffer.
// Run: node examples/process-file.js [path-to-audio-file]

import { readFileSync } from 'node:fs'
import { OfflineAudioContext } from 'web-audio-api'

let file = process.argv[2]
if (!file) { console.log('Usage: node examples/process-file.js <audio-file>'); process.exit(1) }

let data = readFileSync(file)
let tmp = new OfflineAudioContext(1, 1, 44100)
let source = await tmp.decodeAudioData(data)

console.log('Input:', source.numberOfChannels, 'ch,', source.length, 'samples,', source.sampleRate, 'Hz')

let ctx = new OfflineAudioContext(source.numberOfChannels, source.length, source.sampleRate)

let src = ctx.createBufferSource()
src.buffer = source

let eq = ctx.createBiquadFilter()
eq.type = 'highshelf'
eq.frequency.value = 4000
eq.gain.value = -6 // cut highs by 6dB

let comp = ctx.createDynamicsCompressor()
comp.threshold.value = -20
comp.ratio.value = 4

src.connect(eq).connect(comp).connect(ctx.destination)
src.start()

let result = await ctx.startRendering()
let peak = 0
for (let ch = 0; ch < result.numberOfChannels; ch++)
  for (let s of result.getChannelData(ch)) peak = Math.max(peak, Math.abs(s))

console.log('Output:', result.numberOfChannels, 'ch,', result.length, 'samples')
console.log('Peak:', (20 * Math.log10(peak)).toFixed(1), 'dBFS')
