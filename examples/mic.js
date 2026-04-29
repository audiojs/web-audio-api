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

const ctx = new AudioContext({ sampleRate })
await ctx.resume()

// MediaStreamAudioSourceNode accepts externally-pushed Float32 PCM blocks via pushData().
// We feed it from audio-mic, converting Int16 → Float32 per channel.
const src = new MediaStreamAudioSourceNode(ctx, { numberOfChannels: channels })
const gain = ctx.createGain()
gain.gain.value = gainVal
src.connect(gain).connect(ctx.destination)

// audio-mic yields interleaved Int16 PCM Buffers. Deinterleave + normalize.
let read = mic({ sampleRate, channels, bitDepth: 16 })
let peak = 0
read((err, buf) => {
  if (err) return
  if (!buf) return
  let samples = buf.length / 2 // Int16 = 2 bytes
  let frames = samples / channels
  let chans = []
  for (let c = 0; c < channels; c++) chans.push(new Float32Array(frames))
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      let s = buf.readInt16LE((i * channels + c) * 2) / 32768
      chans[c][i] = s
      let a = Math.abs(s); if (a > peak) peak = a
    }
  }
  src.pushData(channels === 1 ? chans[0] : chans)
})

let print = status()
let tick = setInterval(() => {
  let db = peak > 0 ? 20 * Math.log10(peak) : -Infinity
  let bars = Math.max(0, Math.min(30, Math.round((db + 60) / 2)))
  let meter = '█'.repeat(bars) + '·'.repeat(30 - bars)
  print(`mic → gain ${gain.gain.value.toFixed(2)} → out  [${meter}] ${db > -Infinity ? db.toFixed(1) : '-∞'}dB${pausedTag(ctx)}  space · +/- · q`)
  peak *= 0.85
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
