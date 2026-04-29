// Live microphone pass-through — mic → gain → speakers, with RMS meter.
// Requires the `audio-mic` package (cross-platform Node mic capture):
//   npm i audio-mic
// Run: node examples/mic.js
// Run: node examples/mic.js gain=0.8
// Keys: space pause · + / - adjust gain · q quit

import { AudioContext, MediaStreamAudioSourceNode } from 'web-audio-api'
import mic from 'audio-mic'
import { args, keys, status, clearLine, pausedTag } from './_util.js'

let { $ } = args()
let gainVal = parseFloat($('gain', '1'))
let sampleRate = parseInt($('rate', '44100'))
let channels = parseInt($('ch', '1'))
let bitDepth = parseInt($('bit', '16'))

const ctx = new AudioContext({ sampleRate })
await ctx.resume()

const src = new MediaStreamAudioSourceNode(ctx, { numberOfChannels: channels, bitDepth })
const gain = ctx.createGain()
const analyser = ctx.createAnalyser()
gain.gain.value = gainVal
analyser.fftSize = 1024
src.connect(gain).connect(analyser).connect(ctx.destination)

let read = mic({ sampleRate, channels, bitDepth })
read((err, buf) => {
  if (err || !buf) return
  src.pushData(buf, { channels, bitDepth })
})

let samples = new Float32Array(analyser.fftSize)
let print = status()
let tick = setInterval(() => {
  analyser.getFloatTimeDomainData(samples)
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  let db = 20 * Math.log10(Math.max(Math.sqrt(sum / samples.length), 1e-6))
  let bars = Math.max(0, Math.min(30, Math.round((db + 60) / 2)))
  let meter = '█'.repeat(bars) + '·'.repeat(30 - bars)
  print(`mic → gain ${gain.gain.value.toFixed(2)} → out  [${meter}] ${db.toFixed(1)}dB${pausedTag(ctx)}  space · +/- · q`)
}, 50)

const cleanup = () => {
  clearInterval(tick)
  try { read(null) } catch {}
  clearLine()
  ctx.close()
}

keys({
  '+': () => { gain.gain.value = Math.min(4, gain.gain.value * 1.25) },
  '=': () => { gain.gain.value = Math.min(4, gain.gain.value * 1.25) },
  '-': () => { gain.gain.value = Math.max(0, gain.gain.value / 1.25) },
}, cleanup, ctx)

console.log(`mic → ${channels}ch @ ${sampleRate}Hz (backend: ${read.backend || 'auto'})`)
