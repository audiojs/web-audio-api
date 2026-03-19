// FFT analysis: generate a signal and print its frequency spectrum.
// Run: node examples/fft.js

import { OfflineAudioContext } from 'web-audio-api'

const sr = 44100
const ctx = new OfflineAudioContext(1, sr, sr) // 1 second

// Create a signal with two clear frequencies
let osc1 = ctx.createOscillator()
osc1.frequency.value = 440 // A4

let osc2 = ctx.createOscillator()
osc2.frequency.value = 880 // A5

let mix = ctx.createGain()
mix.gain.value = 0.5

let analyser = ctx.createAnalyser()
analyser.fftSize = 2048

osc1.connect(mix).connect(analyser).connect(ctx.destination)
osc2.connect(mix)

osc1.start()
osc2.start()

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
