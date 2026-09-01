// Read an audio file, apply EQ + compression, render to buffer.
// Run: node examples/process-file.js [path-to-audio-file]

import { readFileSync } from 'node:fs'
import { OfflineAudioContext } from 'web-audio-api'
import { init as buildProcessedBuffer } from './graphs/process-file.js'
import { args, num, help } from './utils.js'

help({
  description: 'decode an audio file, apply EQ and compression, and render it',
  usage: ['<audio-file>'],
  options: [
    ['audio-file', 'path to any format supported by decodeAudioData()'],
    ['shelf=<db>', 'high-shelf gain above 4 kHz (default: -6)'],
    ['threshold=<db>', 'compressor threshold (default: -20)'],
  ],
  notes: ['The example reports the rendered buffer and peak level; it does not write an output file.'],
})

let { pos, $ } = args()
let shelf = num($('shelf', -6))
let threshold = num($('threshold', -20))
let file = pos.find(t => !t.includes('='))
if (!file) { console.log('Usage: node examples/process-file.js <audio-file>'); process.exit(1) }

let data = readFileSync(file)
let tmp = new OfflineAudioContext(1, 1, 44100)
let source = await tmp.decodeAudioData(data)

console.log('Input:', source.numberOfChannels, 'ch,', source.length, 'samples,', source.sampleRate, 'Hz')

let ctx = new OfflineAudioContext(source.numberOfChannels, source.length, source.sampleRate)

buildProcessedBuffer(ctx, source, {
  highShelfFrequency: 4000,
  highShelfGain: shelf,
  threshold,
  ratio: 4,
  when: 0,
})

let result = await ctx.startRendering()
let peak = 0
for (let ch = 0; ch < result.numberOfChannels; ch++)
  for (let s of result.getChannelData(ch)) peak = Math.max(peak, Math.abs(s))

console.log('Output:', result.numberOfChannels, 'ch,', result.length, 'samples')
console.log('Peak:', (20 * Math.log10(peak)).toFixed(1), 'dBFS')
