// FFT analysis: generate a signal and print its frequency spectrum.
// Run: node examples/fft.js

import { OfflineAudioContext } from 'web-audio-api'
import { buildTwoTone } from './_portable.js'
import { help } from './_util.js'

help({
  description: 'render a two-tone signal and inspect its FFT spectrum',
  usage: [''],
  notes: ['Renders 440 Hz + 880 Hz offline, then prints spectral peaks above −40 dB.'],
})

const sr = 44100
const ctx = new OfflineAudioContext(1, sr, sr) // 1 second

// Create a signal with two clear frequencies
let demo = buildTwoTone(ctx, { frequencies: [440, 880], duration: 1, when: 0 })
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
console.log('Signal: 440Hz + 880Hz')
console.log('Peaks above -40dB:')
for (let p of peaks.slice(0, 10))
  console.log('  ' + p.hz + ' Hz: ' + p.dB + ' dB')
