// Latency tester — measures round-trip audio latency by timing clicks against the microphone.
// Requires the `@audio/mic` package (cross-platform Node mic capture):
//   npm i @audio/mic
// Run: node examples/latency-tester.js
// Run: node examples/latency-tester.js interval=2 rate=48000
// Keys: space pause · q quit

import { AudioContext, MediaStream, CustomMediaStreamTrack } from 'web-audio-api'
import { init } from './graphs/latency-tester.js'
import { args, keys, status, clearLine, pausedTag, help } from './utils.js'

help({
  description: 'measure round-trip audio latency with click and microphone correlation',
  usage: ['', 'interval=2 rate=48000 ch=1 backend=process'],
  options: [
    ['interval=<s>', 'time between test clicks (default: 1.5)'],
    ['rate=<hz>', 'microphone sample rate (default: 44100)'],
    ['ch=<number>', 'input channels (default: 1)'],
    ['bit=<number>', 'input PCM bit depth (default: 16)'],
    ['backend=<name>', '@audio/mic backend: miniaudio/auto (default) or process'],
  ],
  controls: [['Space', 'pause/resume'], ['Q / Esc', 'quit']],
  notes: [
    'Requires the optional @audio/mic package. The process backend uses sox/ffmpeg as a fallback.',
    'Use speakers, not headphones, so the microphone can hear the click.',
  ],
})

let { $ } = args()
let interval = parseFloat($('interval', 1.5))
let sampleRate = parseInt($('rate', '44100'))
let channels = parseInt($('ch', '1'))
let bitDepth = parseInt($('bit', '16'))
let backend = $('backend')   // 'miniaudio' (default) or 'process' (sox/ffmpeg fallback)

// @audio/mic is an optional peer dependency — fail with a hint, not a stack trace.
let mic
try { mic = (await import('@audio/mic')).default }
catch { console.error('Microphone capture needs the @audio/mic package:\n  npm i @audio/mic'); process.exit(1) }

let ctx = new AudioContext({ sampleRate })
await ctx.resume()

let track = new CustomMediaStreamTrack({ kind: 'audio', label: 'mic', settings: { channelCount: channels, sampleSize: bitDepth, sampleRate } })
let graph = init(ctx, { stream: new MediaStream([track]) })
let analyser = graph.nodes[2]
let emitClick = graph.data.click

// @audio/mic's read(cb) is one-shot — re-arm from inside the callback to keep draining the device.
let read = mic({ sampleRate, channels, bitDepth, ...(backend && { backend }) })
let pump = () => read((err, buf) => {
  if (err || !buf) return
  track.pushData(buf, { channels, bitDepth })
  pump()
})
pump()

let samples = new Float32Array(analyser.fftSize)
let history = [], pending = null, lastScheduled = -Infinity
let threshold = 0.06

let scheduleClick = () => {
  let when = ctx.currentTime + 0.05
  emitClick(when)
  pending = { when, deadline: when + 0.8 }
  lastScheduled = when
}

let render = status()
let tick = setInterval(() => {
  analyser.getFloatTimeDomainData(samples)
  let now = ctx.currentTime
  if (pending) {
    for (let i = 0; i < samples.length; i++) {
      if (Math.abs(samples[i]) <= threshold) continue
      let sampleTime = now - (samples.length - i) / sampleRate
      if (sampleTime <= pending.when + 0.003) continue // ignore the click's own emission window
      history.push((sampleTime - pending.when) * 1000)
      if (history.length > 7) history.shift()
      pending = null
      break
    }
    if (pending && now > pending.deadline) pending = null // honest miss: try again next interval
  } else if (now > lastScheduled + interval) scheduleClick()

  let sorted = [...history].sort((a, b) => a - b)
  let median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null
  let line = median == null
    ? (pending ? 'listening for the click…' : 'no click detected yet — raise the volume or mic gain')
    : `${median.toFixed(0)} ms round trip (median of ${history.length})`
  render(`latency: ${line}${pausedTag(ctx)}  space pause · q quit`)
}, 40)

let cleanup = () => {
  clearInterval(tick)
  try { read(null) } catch {}
  clearLine()
  ctx.close()
}

keys({}, cleanup, ctx)

console.log(`latency tester → ${channels}ch @ ${sampleRate}Hz, click every ${interval}s (backend: ${read.backend || 'auto'})`)
