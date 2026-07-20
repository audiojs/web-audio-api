// Live microphone pass-through — mic → gain → speakers, with RMS meter.
// Requires the `audio-mic` package (cross-platform Node mic capture):
//   npm i audio-mic
// Run: node examples/mic.js
// Run: node examples/mic.js gain=0.8
// Keys: space pause · + / - adjust gain · q quit

import { AudioContext, MediaStreamAudioSourceNode, MediaStream, CustomMediaStreamTrack } from 'web-audio-api'
import { args, keys, status, clearLine, pausedTag, help } from './_util.js'

help({
  description: 'monitor a live microphone through the audio graph',
  usage: ['', 'gain=0.8 rate=48000 ch=2 backend=process'],
  options: [
    ['gain=<number>', 'input gain (default: 1)'],
    ['rate=<hz>', 'sample rate (default: 44100)'],
    ['ch=<number>', 'input channels (default: 1)'],
    ['bit=<number>', 'input PCM bit depth (default: 16)'],
    ['backend=<name>', 'audio-mic backend: miniaudio/auto (default) or process'],
  ],
  controls: [['Space', 'pause/resume'], ['+ / −', 'adjust input gain'], ['Q / Esc', 'quit']],
  notes: ['Requires the optional audio-mic package. The process backend uses sox/ffmpeg as a fallback.'],
})

let { $ } = args()
let gainVal = parseFloat($('gain', '1'))
let sampleRate = parseInt($('rate', '44100'))
let channels = parseInt($('ch', '1'))
let bitDepth = parseInt($('bit', '16'))
let backend = $('backend')   // 'miniaudio' (default) or 'process' (sox/ffmpeg fallback)

// audio-mic is optional; keep --help usable even when it is not installed.
let mic
try { mic = (await import('audio-mic')).default }
catch { console.error('Microphone capture needs the audio-mic package:\n  npm i audio-mic'); process.exit(1) }

const ctx = new AudioContext({ sampleRate })
await ctx.resume()

const track = new CustomMediaStreamTrack({ kind: 'audio', label: 'mic', settings: { channelCount: channels, sampleSize: bitDepth, sampleRate } })
const stream = new MediaStream([track])

const src = new MediaStreamAudioSourceNode(ctx, { mediaStream: stream })
const gain = ctx.createGain()
const analyser = ctx.createAnalyser()
gain.gain.value = gainVal
analyser.fftSize = 1024
src.connect(gain).connect(analyser).connect(ctx.destination)

// audio-mic's read(cb) is one-shot — re-arm from inside the callback to keep draining the device.
let read = mic({ sampleRate, channels, bitDepth, ...(backend && { backend }) })
let pump = () => read((err, buf) => {
  if (err || !buf) return
  track.pushData(buf, { channels, bitDepth })
  pump()
})
pump()

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
