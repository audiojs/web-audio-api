// Metronome — programmable click pattern (drum tab notation).
// X = accent, x = hit, - = rest; each character is an eighth note.
// Default practice session: 10 minutes, accelerating from 80 to 240 BPM.
// Run: node examples/metronome.js 120 X-x-X-x-
// Run: node examples/metronome.js 80..240 10m X-x-x-x-
// Run: node examples/metronome.js bpm=90 -d 30s pat=X-x-x- sound=wood
//   Waltz: X-x-x-   Rock: X-x-X-x-   Reggaeton: X--x--x-
// Keys: space pause · ←/→ tempo ±2 BPM · ↑/↓ cycle sound · t tap-tempo · q quit

import { AudioContext } from 'web-audio-api'
import { args, num, sec, keys, status, clearLine, pausedTag, help } from './_util.js'

help({
  description: 'run a programmable practice metronome',
  usage: ['', '[bpm|start..end] [duration] [pattern]', '120 X-x-X-x-', '80..240 10m X-x-x-x-', 'bpm=90 dur=30s pat=X-x-x- sound=wood'],
  options: [
    ['bpm=<bpm|start..end>', 'fixed tempo or linear tempo ramp (default: 80..240)'],
    ['-d, --duration <time>', 'session length with optional s/m/h suffix (default: 10m)'],
    ['pat=<pattern>', 'X accent, x regular click, - or . rest; each character is an eighth note (default: X-x-x-x-)'],
    ['sound=<preset>', 'classic stick (default), wood, bell, beep, or signal'],
    ['hi=<hz>', 'classic stick accent resonance (default: 1900)'],
    ['lo=<hz>', 'classic stick regular resonance (default: 1250)'],
  ],
  controls: [
    ['Space', 'pause/resume'], ['← / →', 'offset tempo by −/+2 BPM'], ['↑ / ↓', 'cycle sound preset'],
    ['T', 'set tempo from the last four taps'], ['Q / Esc', 'quit'],
  ],
  notes: [
    'Patterns: 4/4 X-x-x-x- · 3/4 X-x-x- · rock X-x-X-x- · reggaeton X--x--x-.',
    'Preset names and option names also accept key=value or --key value syntax.',
  ],
})

let { pos, $ } = args()

let bpmTok = pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t))
let [bpm0, bpm1] = (bpmTok || $('bpm', '80..240')).toString().split('..').map(Number)
if (!bpm1) bpm1 = bpm0

let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '10m'))
let pat = (pos.find(t => /^[Xx.\-]+$/.test(t)) || $('pat', 'X-x-x-x-')).split('')
let hi = num($('hi', 1900)), lo = num($('lo', 1250))

// These are different instruments, not small variations on one click model:
// a dry stick, a hollow block, a ringing bell, a square-wave beep, and the pure
// 880/440 Hz signal from the original example.
let sounds = [
  { name: 'classic', kind: 'stick',  a: hi,   g: lo },
  { name: 'wood',    kind: 'wood',   a: 1400, g: 700 },
  { name: 'bell',    kind: 'bell',   a: 1760, g: 880 },
  { name: 'beep',    kind: 'beep',   a: 2600, g: 1700 },
  { name: 'signal',  kind: 'signal', a: 880,  g: 440 },
]
let wantedSound = String($('sound', 'classic')).toLowerCase()
let sIdx = sounds.findIndex(s => s.name.startsWith(wantedSound))
if (sIdx < 0) sIdx = 0

let ctx = new AudioContext()
await ctx.resume()

let master = ctx.createGain()
master.gain.value = 0.7
master.connect(ctx.destination)

// Reuse a long noise buffer but start at a random offset so consecutive attacks differ.
let noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate), ctx.sampleRate)
let noiseData = noiseBuffer.getChannelData(0)
for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1

// Source nodes dispose themselves after they end, but the filters/gains downstream
// stay connected to master unless we release the tail of each transient graph.
// Hundreds of stale click graphs otherwise make a long accelerating session fall
// behind real time even while the displayed (audio-clock) BPM keeps increasing.
let releaseOnEnd = (source, tail) => {
  source.onended = () => tail.disconnect()
}

let noiseHit = (when, frequency, duration, gain, type) => {
  let burst = ctx.createBufferSource()
  burst.buffer = noiseBuffer
  let filter = ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.value = Math.min(ctx.sampleRate * 0.4, frequency)
  filter.Q.value = 0.7
  let env = ctx.createGain()
  env.gain.setValueAtTime(gain, when)
  env.gain.exponentialRampToValueAtTime(0.001, when + duration)
  burst.connect(filter).connect(env).connect(master)
  releaseOnEnd(burst, env)
  burst.start(when, Math.random() * (noiseBuffer.duration - duration))
  burst.stop(when + duration)
}

let click = (when, ch) => {
  if (ch === '-' || ch === '.') return
  let strong = ch === 'X'
  let s = sounds[sIdx]
  let f = strong ? s.a : s.g

  if (s.kind === 'stick') {
    // Classic metronome stick: a hard tip attack with two very short wood modes.
    let duration = strong ? 0.028 : 0.020
    let body = ctx.createGain()
    body.gain.setValueAtTime(strong ? 0.28 : 0.18, when)
    body.gain.exponentialRampToValueAtTime(0.001, when + duration)
    body.connect(master)
    let lastOsc
    for (let [ratio, level] of [[1, 1], [1.63, 0.36]]) {
      let osc = lastOsc = ctx.createOscillator()
      let modeGain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = f * ratio
      modeGain.gain.value = level
      osc.connect(modeGain).connect(body)
      osc.start(when); osc.stop(when + duration + 0.005)
    }
    releaseOnEnd(lastOsc, body)
    noiseHit(when, f * 2.2, strong ? 0.008 : 0.006, strong ? 0.16 : 0.10, 'bandpass')
    return
  }

  if (s.kind === 'wood') {
    // Hollow woodblock: two low, inharmonic body modes and a muted strike.
    let duration = strong ? 0.085 : 0.060
    let body = ctx.createGain()
    body.gain.setValueAtTime(strong ? 0.34 : 0.24, when)
    body.gain.exponentialRampToValueAtTime(0.001, when + duration)
    body.connect(master)
    let lastOsc
    for (let [ratio, level] of [[1, 1], [1.67, 0.30]]) {
      let osc = lastOsc = ctx.createOscillator()
      let modeGain = ctx.createGain()
      osc.frequency.value = f * ratio
      modeGain.gain.value = level
      osc.connect(modeGain).connect(body)
      osc.start(when); osc.stop(when + duration + 0.005)
    }
    releaseOnEnd(lastOsc, body)
    noiseHit(when, f * 2.2, 0.012, strong ? 0.08 : 0.05, 'lowpass')
    return
  }

  if (s.kind === 'bell') {
    // Bell: a soft attack and long inharmonic ring, deliberately without noise.
    let duration = strong ? 0.28 : 0.20
    let body = ctx.createGain()
    body.gain.setValueAtTime(0, when)
    body.gain.linearRampToValueAtTime(strong ? 0.17 : 0.11, when + 0.0015)
    body.gain.exponentialRampToValueAtTime(0.001, when + duration)
    body.connect(master)
    let lastOsc
    for (let [ratio, level] of [[1, 1], [1.48, 0.52], [2.09, 0.27], [2.63, 0.13]]) {
      let osc = lastOsc = ctx.createOscillator()
      let modeGain = ctx.createGain()
      osc.frequency.value = f * ratio
      modeGain.gain.value = level
      osc.connect(modeGain).connect(body)
      osc.start(when); osc.stop(when + duration + 0.01)
    }
    releaseOnEnd(lastOsc, body)
    return
  }

  if (s.kind === 'beep') {
    // Digital beep: bright, flat and gated instead of decaying like a strike.
    let duration = strong ? 0.065 : 0.045
    let osc = ctx.createOscillator()
    let env = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = f
    env.gain.setValueAtTime(0, when)
    env.gain.linearRampToValueAtTime(strong ? 0.15 : 0.09, when + 0.001)
    env.gain.setValueAtTime(strong ? 0.15 : 0.09, when + duration - 0.006)
    env.gain.linearRampToValueAtTime(0, when + duration)
    osc.connect(env).connect(master)
    releaseOnEnd(osc, env)
    osc.start(when); osc.stop(when + duration + 0.005)
    return
  }

  // Restore the original signal preset: clean 880 Hz accents and 440 Hz beats.
  let duration = 0.070
  let peak = strong ? 0.60 : 0.25
  let osc = ctx.createOscillator()
  let env = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = f
  env.gain.setValueAtTime(0, when)
  env.gain.linearRampToValueAtTime(peak, when + 0.003)
  env.gain.setValueAtTime(peak, when + duration - 0.020)
  env.gain.linearRampToValueAtTime(0, when + duration)
  osc.connect(env).connect(master)
  releaseOnEnd(osc, env)
  osc.start(when); osc.stop(when + duration + 0.005)
}

let t0 = ctx.currentTime
let userOffset = 0
let tapTimes = []
let next = t0 + 0.05, i = 0
let curBpm = bpm0
let schedAhead = 0.15

let sched = setInterval(() => {
  if (ctx.state !== 'running') return
  while (next < ctx.currentTime + schedAhead && next < t0 + dur && ctx.currentTime < t0 + dur) {
    let p = Math.min((next - t0) / dur, 1)
    curBpm = Math.max(20, bpm0 + (bpm1 - bpm0) * p + userOffset)
    click(next, pat[i % pat.length])
    next += 30 / curBpm
    i++
  }
}, 25)

let render = status()
let draw = () => {
  let p = Math.min(Math.max((ctx.currentTime - t0) / dur, 0), 1)
  curBpm = Math.max(20, bpm0 + (bpm1 - bpm0) * p + userOffset)
  let bar = '█'.repeat(Math.floor(p * 20)).padEnd(20, '░')
  render(`♩ ${curBpm.toFixed(1).padStart(6)} · [${pat.join('')}] · ${sounds[sIdx].name.padEnd(10)} ${bar} ${(p * 100).toFixed(0).padStart(3)}%${pausedTag(ctx)}`)
}
let ui = setInterval(draw, 50)
let endTimer
let finish = auto => {
  clearInterval(sched); clearInterval(ui); clearInterval(endTimer)
  clearLine(); ctx.close()
  if (auto) process.exit(0)
}

keys({
  left: () => { userOffset -= 2 },
  right: () => { userOffset += 2 },
  up: () => { sIdx = (sIdx + 1) % sounds.length },
  down: () => { sIdx = (sIdx - 1 + sounds.length) % sounds.length },
  t: () => {
    let now = Date.now()
    tapTimes.push(now)
    if (tapTimes.length > 4) tapTimes.shift()
    if (tapTimes.length >= 2) {
      let diffs = tapTimes.slice(1).map((t, k) => t - tapTimes[k])
      let avg = diffs.reduce((a, b) => a + b) / diffs.length
      let tapped = 60000 / avg
      userOffset = tapped - (bpm0 + (bpm1 - bpm0) * Math.min((ctx.currentTime - t0) / dur, 1))
    }
  },
}, () => finish(false), ctx)

let header = bpm0 === bpm1 ? `♩ = ${bpm0}` : `♩ = ${bpm0}→${bpm1}`
console.log(`${header}  [${pat.join('')}]  (${dur}s)  space pause · ← → tempo · ↑ ↓ sound · t tap · q quit`)

// AudioContext time stops while suspended, so practice time does not elapse while paused.
endTimer = setInterval(() => {
  if (ctx.currentTime >= t0 + dur) finish(true)
}, 50)
