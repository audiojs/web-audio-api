// Guitar tuner — listen through the mic, show the note and how far off it is, in cents.
// Pitch is found by time-domain autocorrelation (McLeod) — accurate to ~1 cent,
// where raw FFT bins (~11 Hz wide here) are far too coarse.
// Requires the `audio-mic` package (cross-platform Node mic capture):
//   npm i audio-mic
// Run: node examples/tuner.js          # A = 432 Hz
// Run: node examples/tuner.js 440      # standard concert pitch
// Run: node examples/tuner.js a=415 rate=48000
// Keys: 1-6 play a string's reference tone · space stop it · ↑/↓ nudge A ±1 Hz · q quit

import { AudioContext, MediaStreamAudioSourceNode, MediaStream, CustomMediaStreamTrack } from 'web-audio-api'
import { args, keys, status, clearLine } from './_util.js'

let { pos, $ } = args()
let a4 = parseFloat(pos.find(t => /^\d+(\.\d+)?$/.test(t)) || $('a', '432'))
let sampleRate = parseInt($('rate', '44100'))
let channels = parseInt($('ch', '1'))
let bitDepth = parseInt($('bit', '16'))
let backend = $('backend')   // 'miniaudio' (default) or 'process' (sox/ffmpeg fallback)

// audio-mic is an optional peer dependency — fail with a hint, not a stack trace.
let mic
try { mic = (await import('audio-mic')).default }
catch { console.error('Microphone capture needs the audio-mic package:\n  npm i audio-mic'); process.exit(1) }

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

// --- pitch detection: McLeod NSDF + parabolic interpolation ---
function detect(buf, sr) {
  let n = buf.length, mean = 0
  for (let i = 0; i < n; i++) mean += buf[i]
  mean /= n
  let x = new Float32Array(n), rms = 0
  for (let i = 0; i < n; i++) { x[i] = buf[i] - mean; rms += x[i] * x[i] }
  if (Math.sqrt(rms / n) < 0.003) return null // silence

  let minLag = Math.floor(sr / 520)            // ignore anything above ~C5
  let maxLag = Math.min(Math.ceil(sr / 60), n - 2) // ...or below ~B1
  let nsdf = new Float32Array(maxLag + 1)
  for (let tau = 0; tau <= maxLag; tau++) {
    let ac = 0, m = 0
    for (let i = 0; i < n - tau; i++) {
      let a = x[i], b = x[i + tau]
      ac += a * b
      m += a * a + b * b
    }
    nsdf[tau] = m > 0 ? 2 * ac / m : 0
  }

  let tau = 1
  while (tau < maxLag && nsdf[tau] > 0) tau++   // step past the central lobe
  let cands = [], best = 0
  for (; tau < maxLag; tau++)
    if (nsdf[tau] > nsdf[tau - 1] && nsdf[tau] >= nsdf[tau + 1]) {
      cands.push(tau)
      if (nsdf[tau] > best) best = nsdf[tau]
    }
  if (best < 0.6) return null                   // no clear periodicity

  // McLeod pick: first peak within 90% of the strongest — beats octave errors
  let peak = cands.find(t => nsdf[t] >= 0.9 * best)
  if (peak === undefined || peak < minLag) return null

  let y0 = nsdf[peak - 1], y1 = nsdf[peak], y2 = nsdf[peak + 1]
  let d = y0 - 2 * y1 + y2
  let period = peak + (d !== 0 ? 0.5 * (y0 - y2) / d : 0)
  return { freq: sr / period }
}

// --- audio graph: mic → analyser (not routed to speakers, so no echo) ---
let ctx = new AudioContext({ sampleRate })
await ctx.resume()

let track = new CustomMediaStreamTrack({ kind: 'audio', label: 'mic', settings: { channelCount: channels, sampleSize: bitDepth, sampleRate } })
let src = new MediaStreamAudioSourceNode(ctx, { mediaStream: new MediaStream([track]) })
let analyser = ctx.createAnalyser()
analyser.fftSize = 4096
let mute = ctx.createGain()
mute.gain.value = 0
src.connect(analyser).connect(mute).connect(ctx.destination) // silent path — drives the render loop, no echo

// audio-mic's read(cb) is one-shot — re-arm from inside the callback to keep draining the device.
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
let smoothed = null, lastHit = 0
let render = status()
let tick = setInterval(() => {
  analyser.getFloatTimeDomainData(frame)
  let p = detect(frame, ctx.sampleRate)
  let now = Date.now()
  if (p) {
    lastHit = now
    smoothed = smoothed && Math.abs(Math.log2(p.freq / smoothed)) < 0.08
      ? smoothed * 0.78 + p.freq * 0.22  // settle a stable note
      : p.freq                           // snap to a new string
  }
  let suffix = `  A=${a4}${ref ? ` ♪${noteOf(ref.s.midi)}` : ''}`
  if (!smoothed || now - lastHit > 1500)
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
