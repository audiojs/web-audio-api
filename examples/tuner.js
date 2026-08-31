// Guitar tuner — listen through the mic, show the note and how far off it is, in cents.
// Pitch is found with audiojs' YIN detector, then stabilized across frames so
// changing overtones and isolated octave errors do not make the display jump.
// Requires the `@audio/mic` package (cross-platform Node mic capture):
//   npm i @audio/mic
// Run: node examples/tuner.js          # A = 432 Hz
// Run: node examples/tuner.js 440      # standard concert pitch
// Run: node examples/tuner.js a=415 rate=48000
// Keys: 1-6 play a string's reference tone · space stop it · ↑/↓ nudge A ±1 Hz · q quit

import { AudioContext, MediaStream, CustomMediaStreamTrack } from 'web-audio-api'
import { build } from './graphs/tuner.js'
import { args, keys, status, clearLine, help } from './utils.js'
import { detectPitch, createPitchTracker } from './tuner-pitch.js'

help({
  description: 'tune a guitar from the microphone or reference tones',
  usage: ['', '[A4-frequency]', 'a=440 rate=48000 ch=1 backend=process'],
  options: [
    ['a=<hz>', 'reference pitch for A4 (default: 432; use 440 for concert pitch)'],
    ['rate=<hz>', 'microphone sample rate (default: 44100)'],
    ['ch=<number>', 'input channels (default: 1)'],
    ['bit=<number>', 'input PCM bit depth (default: 16)'],
    ['backend=<name>', '@audio/mic backend: miniaudio/auto (default) or process'],
  ],
  controls: [
    ['1–6', 'play that guitar string’s reference tone'], ['0 / Space', 'stop the reference tone'],
    ['↑ / ↓', 'change A4 by 1 Hz'], ['Q / Esc', 'quit'],
  ],
  notes: ['Requires the optional @audio/mic package. The process backend uses sox/ffmpeg as a fallback.'],
})

let { pos, $ } = args()
let a4 = parseFloat(pos.find(t => /^\d+(\.\d+)?$/.test(t)) || $('a', '432'))
let sampleRate = parseInt($('rate', '44100'))
let channels = parseInt($('ch', '1'))
let bitDepth = parseInt($('bit', '16'))
let backend = $('backend')   // 'miniaudio' (default) or 'process' (sox/ffmpeg fallback)

// @audio/mic is an optional peer dependency — fail with a hint, not a stack trace.
let mic
try { mic = (await import('@audio/mic')).default }
catch { console.error('Microphone capture needs the @audio/mic package:\n  npm i @audio/mic'); process.exit(1) }

// --- note math, all relative to the chosen A4 (no fixed 440 here) ---
let NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
let freqOf = midi => a4 * 2 ** ((midi - 69) / 12)
let noteOf = midi => NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1)
// standard tuning, 6th (low) → 1st (high) string
let STRINGS = [
  { num: 6, midi: 40, tag: 'low E' },
  { num: 5, midi: 45, tag: 'A' },
  { num: 4, midi: 50, tag: 'D' },
  { num: 3, midi: 55, tag: 'G' },
  { num: 2, midi: 59, tag: 'B' },
  { num: 1, midi: 64, tag: 'high E' },
]

// --- audio graph: mic → analyser (not routed to speakers, so no echo) ---
let ctx = new AudioContext({ sampleRate })
await ctx.resume()

let track = new CustomMediaStreamTrack({ kind: 'audio', label: 'mic', settings: { channelCount: channels, sampleSize: bitDepth, sampleRate } })
let graph = build(ctx, { stream: new MediaStream([track]) })
let analyser = graph.nodes[2]
// Keep enough low-E cycles for a reliable estimate even at 48 kHz.
analyser.fftSize = 8192

// @audio/mic's read(cb) is one-shot — re-arm from inside the callback to keep draining the device.
let read = mic({ sampleRate, channels, bitDepth, ...(backend && { backend }) })
let pump = () => read((err, buf) => {
  if (err || !buf) return
  track.pushData(buf, { channels, bitDepth })
  pump()
})
pump()

// --- reference tone, for tuning by ear (listen for the beats to slow, then stop) ---
let ref = null
function stopRef() {
  if (!ref) return
  let t = ctx.currentTime
  ref.gain.gain.cancelScheduledValues(t)
  ref.gain.gain.setValueAtTime(0.18, t)
  ref.gain.gain.linearRampToValueAtTime(0, t + 0.05)
  ref.osc.stop(t + 0.08)
  ref = null
}
function playRef(s) {
  stopRef()
  let osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.value = freqOf(s.midi)
  let gain = ctx.createGain()
  let t = ctx.currentTime
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(0.18, t + 0.05)
  osc.connect(gain).connect(ctx.destination)
  osc.start()
  ref = { osc, gain, s }
}

// --- display ---
let C = process.stdout.isTTY
let paint = (s, c) => C ? `\x1b[${c}m${s}\x1b[0m` : s
function bar(cents, cc) {
  let W = 21, mid = 10, pos = Math.max(0, Math.min(W - 1, Math.round(mid + cents / 50 * mid)))
  let s = ''
  for (let i = 0; i < W; i++) s += i === pos ? paint('●', cc) : i === mid ? paint('│', 90) : '·'
  return s
}
function line(freq) {
  let mf = 69 + 12 * Math.log2(freq / a4)
  let midi = Math.round(mf)
  let cents = Math.round((mf - midi) * 100), abs = Math.abs(cents)
  let cc = abs <= 5 ? 32 : abs <= 15 ? 33 : 31
  let str = STRINGS.find(s => s.midi === midi)
  let where = (str ? `${str.num}·${str.tag}` : 'chromatic').padEnd(9)
  let dev = abs <= 5 ? 'in tune' : `${cents > 0 ? '+' : '−'}${abs}¢`
  let hint = abs <= 5 ? '' : cents < 0 ? '↑ tighten' : '↓ loosen'
  return `  ${noteOf(midi).padEnd(3)} ${where} ${paint('♭', cents < -5 ? cc : 90)} ${bar(cents, cc)} ${paint('♯', cents > 5 ? cc : 90)}  ${paint(dev.padStart(7), cc)}  ${hint.padEnd(9)} ${freq.toFixed(1).padStart(6)} Hz`
}

let frame = new Float32Array(analyser.fftSize)
let tracker = createPitchTracker()
let smoothed = null, lastHit = 0
let render = status()
let tick = setInterval(() => {
  analyser.getFloatTimeDomainData(frame)
  let p = detectPitch(frame, ctx.sampleRate)
  let now = Date.now()
  let stable = tracker.update(p, a4)
  if (stable !== null) {
    lastHit = now
    smoothed = stable
  }
  if (smoothed && now - lastHit > 1500) {
    smoothed = null
    tracker.reset()
  }
  let suffix = `  A=${a4}${ref ? ` ♪${noteOf(ref.s.midi)}` : ''}`
  if (!smoothed)
    render(`  ${paint('· · ·', 90)}  listening — pluck a single string and let it ring${suffix}`)
  else
    render(line(smoothed) + suffix)
}, 80)

let cleanup = () => {
  clearInterval(tick)
  stopRef()
  try { read(null) } catch {}
  clearLine()
  ctx.close()
}

let byNum = n => STRINGS.find(s => s.num === n)
keys({
  1: () => playRef(byNum(1)), 2: () => playRef(byNum(2)), 3: () => playRef(byNum(3)),
  4: () => playRef(byNum(4)), 5: () => playRef(byNum(5)), 6: () => playRef(byNum(6)),
  0: stopRef, space: stopRef,
  up: () => { a4 = Math.min(480, a4 + 1); if (ref) ref.osc.frequency.setTargetAtTime(freqOf(ref.s.midi), ctx.currentTime, 0.02) },
  down: () => { a4 = Math.max(400, a4 - 1); if (ref) ref.osc.frequency.setTargetAtTime(freqOf(ref.s.midi), ctx.currentTime, 0.02) },
}, cleanup)

console.log(`Guitar tuner · A = ${a4} Hz · standard tuning${a4 === 432 ? '  (pass "440" for standard concert pitch)' : ''}`)
console.log('strings:  ' + STRINGS.map(s => `${s.num} ${noteOf(s.midi)} ${freqOf(s.midi).toFixed(1)}Hz`).join('   '))
console.log(`mic: ${channels}ch @ ${sampleRate}Hz  ·  pluck a string and let it ring  ·  1-6 reference · space stop · ↑↓ A · q quit`)
