// FFT analysis: generate a signal and print its frequency spectrum.
// Run: node examples/fft.js

import { OfflineAudioContext } from 'web-audio-api'
import { init as buildTwoTone } from './graphs/fft.js'
import { args, num, help } from './utils.js'

help({
  description: 'render a two-tone signal and inspect its FFT spectrum',
  usage: ['', 'f1=330 f2=990 fft=4096'],
  options: [
    ['f1=<hz>', 'first tone (default: 440)'],
    ['f2=<hz>', 'second tone (default: 880)'],
    ['fft=<size>', 'analyser resolution (default: 2048)'],
  ],
  notes: ['Renders the two tones offline, then prints spectral peaks above −40 dB.'],
})

let { $ } = args()
let f1 = num($('f1', 440))
let f2 = num($('f2', 880))
let fftSize = parseInt($('fft', '2048'))

const sr = 44100
const ctx = new OfflineAudioContext(1, sr, sr) // 1 second

// Create a signal with two clear frequencies
let demo = buildTwoTone(ctx, { f1, f2, fftSize, duration: 1, when: 0 })
let analyser = demo.data.analyser

await ctx.startRendering()

// Read spectrum
let freq = new Float32Array(analyser.frequencyBinCount)
analyser.getFloatFrequencyData(freq)

let binHz = sr / analyser.fftSize

// Find peaks above -40dB
let peaks = []
for (let i = 1; i < freq.length - 1; i++) {
  if (freq[i] > -40 && freq[i] > freq[i - 1] && freq[i] > freq[i + 1])
    peaks.push({ hz: (i * binHz).toFixed(0), dB: freq[i].toFixed(1) })
}

console.log('FFT analysis (fftSize=' + analyser.fftSize + ', binWidth=' + binHz.toFixed(1) + 'Hz)')
console.log(`Signal: ${f1}Hz + ${f2}Hz`)
console.log('Peaks above -40dB:')
for (let p of peaks.slice(0, 10))
  console.log('  ' + p.hz + ' Hz: ' + p.dB + ' dB')
