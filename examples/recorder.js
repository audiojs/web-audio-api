// Recorder — capture the mic to a WAV file, with a live level meter.
// mic → gain → recorder node → destination (silent) — every sample is captured through the graph.
// Requires the `audio-mic` package (cross-platform Node mic capture):
//   npm i audio-mic
// Run: node examples/recorder.js
// Run: node examples/recorder.js take1 gain=2      # preset name + input gain
// Run: node examples/recorder.js rate=48000 ch=2
// Keys while recording: Enter save · +/- input gain · q cancel

import { writeFileSync } from 'node:fs'
import readline from 'node:readline'
import { AudioContext, MediaStream, CustomMediaStreamTrack, MediaStreamAudioSourceNode } from 'web-audio-api'
import convert from 'pcm-convert'
import { args, status, clearLine } from './_util.js'

let { pos, $ } = args()
let sampleRate = parseInt($('rate', '44100'))
let channels = parseInt($('ch', '1'))
let bitDepth = parseInt($('bit', '16'))
let backend = $('backend')                    // 'miniaudio' (default) or 'process' (sox/ffmpeg fallback)
let nameArg = pos.find(t => !/^\d/.test(t))   // first non-numeric positional → default filename

// audio-mic is an optional peer dependency — fail with a hint, not a stack trace.
let mic
try { mic = (await import('audio-mic')).default }
catch { console.error('Microphone capture needs the audio-mic package:\n  npm i audio-mic'); process.exit(1) }

let C = process.stdout.isTTY
let paint = (s, c) => C ? `\x1b[${c}m${s}\x1b[0m` : s
let p2 = n => String(n).padStart(2, '0')
let clock = s => `${Math.floor(s / 60)}:${p2(Math.floor(s % 60))}`
let stamp = () => { let d = new Date(); return `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}` }

// --- audio graph: mic → gain → recorder; the recorder outputs silence ---
let ctx = new AudioContext({ sampleRate })
await ctx.resume()

let track = new CustomMediaStreamTrack({ kind: 'audio', label: 'mic', settings: { channelCount: channels, sampleSize: bitDepth, sampleRate } })
let src = new MediaStreamAudioSourceNode(ctx, { mediaStream: new MediaStream([track]) })
let gain = ctx.createGain()
gain.gain.value = parseFloat($('gain', '1'))
let recorder = ctx.createScriptProcessor(2048, channels, channels)

let chunks = []          // captured frames: [ [Float32Array per channel], ... ]
let frames = 0           // total sample frames captured
let level = 0, peak = 0  // live RMS and session peak
let recording = true
recorder.onaudioprocess = e => {
  if (!recording) return
  let ib = e.inputBuffer, frame = []
  for (let c = 0; c < channels; c++) frame.push(Float32Array.from(ib.getChannelData(c)))
  chunks.push(frame)
  frames += ib.length
  let d = frame[0], sum = 0, pk = 0
  for (let i = 0; i < d.length; i++) { sum += d[i] * d[i]; let a = Math.abs(d[i]); if (a > pk) pk = a }
  level = Math.sqrt(sum / d.length)
  if (pk > peak) peak = pk
}
src.connect(gain).connect(recorder).connect(ctx.destination)

let read
try {
  // audio-mic's read(cb) is one-shot — re-arm from inside the callback to keep draining the device.
  read = mic({ sampleRate, channels, bitDepth, ...(backend && { backend }) })
  let pump = () => read((err, buf) => {
    if (err || !buf) return
    track.pushData(buf, { channels, bitDepth })
    pump()
  })
  pump()
} catch (e) {
  console.error('Could not open the microphone:', e.message)
  ctx.close(); process.exit(1)
}

// --- live meter ---
let t0 = Date.now()
let render = status()
let ui = setInterval(() => {
  let secs = (Date.now() - t0) / 1000
  let db = 20 * Math.log10(Math.max(level, 1e-6))
  let bars = Math.max(0, Math.min(30, Math.round((db + 60) / 2)))
  let meter = '█'.repeat(bars) + '·'.repeat(30 - bars)
  let cc = peak >= 0.999 ? 31 : db > -6 ? 33 : 32
  let tag = peak >= 0.999 ? paint('  CLIP — lower gain', 31)
    : secs > 2 && peak < 5e-4 ? paint('  ⚠ no input — check mic permission', 31)
    : ''
  render(`${paint('●', 31)} REC  ${clock(secs)}  [${paint(meter, cc)}] ${paint(db.toFixed(1) + 'dB', cc)}  gain ${gain.gain.value.toFixed(2)}${tag}`)
}, 70)

// --- WAV writer (canonical 44-byte PCM header) ---
function wavHeader(dataLen) {
  let h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + dataLen, 4); h.write('WAVE', 8)
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20)
  h.writeUInt16LE(channels, 22); h.writeUInt32LE(sampleRate, 24)
  h.writeUInt32LE(sampleRate * channels * bitDepth / 8, 28)
  h.writeUInt16LE(channels * bitDepth / 8, 32); h.writeUInt16LE(bitDepth, 34)
  h.write('data', 36); h.writeUInt32LE(dataLen, 40)
  return h
}
function save(file) {
  let merged = []
  for (let c = 0; c < channels; c++) {
    let arr = new Float32Array(frames), off = 0
    for (let f of chunks) { arr.set(f[c], off); off += f[c].length }
    merged.push(arr)
  }
  let pcm = Buffer.from(convert(merged, 'float32 planar', `int${bitDepth} interleaved le`).buffer)
  writeFileSync(file, Buffer.concat([wavHeader(pcm.length), pcm]))
  let kb = (44 + pcm.length) / 1024
  console.log(`saved  ${file}  ·  ${clock(frames / sampleRate)}  ·  ${kb < 1024 ? kb.toFixed(0) + ' KB' : (kb / 1024).toFixed(1) + ' MB'}  ·  ${sampleRate} Hz ${channels === 1 ? 'mono' : channels + 'ch'} ${bitDepth}-bit`)
}

// --- input: keypresses while recording, then a line prompt for the filename ---
let stdin = process.stdin
readline.emitKeypressEvents(stdin)
if (stdin.isTTY) stdin.setRawMode(true)
stdin.resume()

let stopCapture = () => { recording = false; clearInterval(ui); try { read(null) } catch {} }
let onKey = (str, key) => {
  if (!key) return
  if (key.name === 'return' || key.name === 'enter') return finish()
  if (key.name === 'q' || key.name === 'escape' || (key.ctrl && key.name === 'c')) return cancel()
  if (str === '+' || str === '=') gain.gain.value = Math.min(8, gain.gain.value * 1.26)
  if (str === '-' || str === '_') gain.gain.value = Math.max(0, gain.gain.value / 1.26)
}
stdin.on('keypress', onKey)

function done(msg) {
  if (stdin.isTTY) stdin.setRawMode(false)
  if (msg) console.log(msg)
  ctx.close()
  process.exit(0)
}
function cancel() {
  stopCapture(); stdin.off('keypress', onKey); clearLine()
  done('cancelled — nothing saved')
}
function finish() {
  stopCapture(); stdin.off('keypress', onKey); clearLine()
  if (!frames) return done('nothing recorded')
  if (stdin.isTTY) stdin.setRawMode(false)
  let def = (nameArg || `recording-${stamp()}`).replace(/\.wav$/i, '')
  let rl = readline.createInterface({ input: stdin, output: process.stdout })
  rl.question(`save as [${def}.wav]: `, answer => {
    rl.close()
    save((answer.trim() || def).replace(/\.wav$/i, '') + '.wav')
    done()
  })
}

console.log(`Recorder · ${sampleRate} Hz · ${channels === 1 ? 'mono' : channels + ' channels'} · ${bitDepth}-bit  (backend: ${read.backend || 'auto'})`)
console.log('recording… press Enter to save · +/- input gain · q to cancel')
