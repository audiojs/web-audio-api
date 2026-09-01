// Level meter — live microphone RMS and peak level in dBFS (uncalibrated).
// Requires the `@audio/mic` package (cross-platform Node mic capture):
//   npm i @audio/mic
// Run: node examples/level-meter.js
// Run: node examples/level-meter.js ballistics=fast rate=48000
// Keys: space pause · q quit

import { AudioContext, MediaStream, CustomMediaStreamTrack } from 'web-audio-api'
import { init } from './graphs/level-meter.js'
import { args, keys, status, clearLine, pausedTag, help } from './utils.js'

help({
  description: 'show live microphone RMS and peak level in dBFS (uncalibrated)',
  usage: ['', 'ballistics=fast rate=48000 ch=2 backend=process'],
  options: [
    ['ballistics=<fast|slow>', 'meter response speed (default: slow)'],
    ['gain=<number>', 'input gain (default: 1)'],
    ['rate=<hz>', 'sample rate (default: 44100)'],
    ['ch=<number>', 'input channels (default: 1)'],
    ['bit=<number>', 'input PCM bit depth (default: 16)'],
    ['backend=<name>', '@audio/mic backend: miniaudio/auto (default) or process'],
  ],
  controls: [['Space', 'pause/resume'], ['Q / Esc', 'quit']],
  notes: ['Requires the optional @audio/mic package. The process backend uses sox/ffmpeg as a fallback.'],
})

let { $ } = args()
let ballistics = String($('ballistics', 'slow')).toLowerCase() === 'fast' ? 'fast' : 'slow'
let gain = parseFloat($('gain', '1'))
let sampleRate = parseInt($('rate', '44100'))
let channels = parseInt($('ch', '1'))
let bitDepth = parseInt($('bit', '16'))
let backend = $('backend')   // 'miniaudio' (default) or 'process' (sox/ffmpeg fallback)

// @audio/mic is optional; keep --help usable even when it is not installed.
let mic
try { mic = (await import('@audio/mic')).default }
catch { console.error('Microphone capture needs the @audio/mic package:\n  npm i @audio/mic'); process.exit(1) }

let ctx = new AudioContext({ sampleRate })
await ctx.resume()

let track = new CustomMediaStreamTrack({ kind: 'audio', label: 'mic', settings: { channelCount: channels, sampleSize: bitDepth, sampleRate } })
let graph = init(ctx, { stream: new MediaStream([track]), gain })
let analyser = graph.nodes[2]

// @audio/mic's read(cb) is one-shot — re-arm from inside the callback to keep draining the device.
let read = mic({ sampleRate, channels, bitDepth, ...(backend && { backend }) })
let pump = () => read((err, buf) => {
  if (err || !buf) return
  track.pushData(buf, { channels, bitDepth })
  pump()
})
pump()

// Simple envelope-follower ballistics: fast tracks both rises and falls quickly,
// slow is more damped, closer to a traditional VU meter.
let attack = ballistics === 'fast' ? 0.6 : 0.25, release = ballistics === 'fast' ? 0.35 : 0.06
let rmsEnv = 1e-6, peakEnv = 1e-6
let samples = new Float32Array(analyser.fftSize)
let dbfs = v => 20 * Math.log10(Math.max(v, 1e-6))
let bar = db => { let n = Math.max(0, Math.min(30, Math.round((db + 60) / 2))); return '█'.repeat(n) + '·'.repeat(30 - n) }

let render = status()
let tick = setInterval(() => {
  analyser.getFloatTimeDomainData(samples)
  let sum = 0, peak = 0
  for (let value of samples) { sum += value * value; peak = Math.max(peak, Math.abs(value)) }
  let instRms = Math.sqrt(sum / samples.length)
  rmsEnv += (instRms - rmsEnv) * (instRms > rmsEnv ? attack : release)
  peakEnv += (peak - peakEnv) * (peak > peakEnv ? 1 : release * 0.4)
  render(`[${bar(dbfs(rmsEnv))}] RMS ${dbfs(rmsEnv).toFixed(1)} dBFS  peak ${dbfs(peakEnv).toFixed(1)} dBFS  (${ballistics})${pausedTag(ctx)}  space · q`)
}, 50)

let cleanup = () => {
  clearInterval(tick)
  try { read(null) } catch {}
  clearLine()
  ctx.close()
}

keys({}, cleanup, ctx)

console.log(`level meter → ${channels}ch @ ${sampleRate}Hz, ${ballistics} ballistics (backend: ${read.backend || 'auto'})`)
