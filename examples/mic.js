// Live microphone → speakers with an RMS VU meter.
// Requires `audio-mic` (optional peer dep):  npm install audio-mic
//
// Run:   node examples/mic.js
// Keys:  ↑/↓ gain · space pause · q quit
//
// Two equivalent paths:
//  (1) Browser-parity — via polyfill + navigator.mediaDevices.getUserMedia (below)
//  (2) Node-native    — via `createMediaStream(mic(...), opts)` (see README mic FAQ)

import 'web-audio-api/polyfill'
import { args, keys, status, clearLine, pausedTag } from './_util.js'

let { $ } = args()
let channels = +$('ch', '1')
let bitDepth = +$('bit', '16')

const ctx = new AudioContext()
await ctx.resume()

let stream
try {
  stream = await navigator.mediaDevices.getUserMedia({
    audio: { sampleRate: ctx.sampleRate, channelCount: channels, sampleSize: bitDepth }
  })
} catch (err) {
  console.error(err.message)
  process.exit(1)
}

const src = ctx.createMediaStreamSource(stream)
const gain = ctx.createGain()
const analyser = ctx.createAnalyser()
analyser.fftSize = 1024
src.connect(gain).connect(analyser).connect(ctx.destination)

const buf = new Float32Array(analyser.fftSize)
const render = status()
let interval = setInterval(() => {
  analyser.getFloatTimeDomainData(buf)
  let sum = 0
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
  let db = 20 * Math.log10(Math.max(Math.sqrt(sum / buf.length), 1e-6))
  let meter = '█'.repeat(Math.max(0, Math.min(30, Math.round((db + 60) / 2))))
  render(`mic  gain ${gain.gain.value.toFixed(2)}  ${db.toFixed(1).padStart(6)} dB  ${meter}${pausedTag(ctx)}`)
}, 50)

keys({
  up: () => { gain.gain.value = Math.min(4, gain.gain.value * 1.2) },
  down: () => { gain.gain.value = Math.max(0.01, gain.gain.value / 1.2) },
}, () => {
  clearInterval(interval)
  stream.getTracks().forEach(t => t.stop())
  clearLine()
  ctx.close()
}, ctx)

console.log('mic → speakers  ↑/↓ gain · space pause · q quit')
