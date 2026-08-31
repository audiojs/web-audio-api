// Metronome — programmable click pattern (drum tab notation).
// X = accent, x = hit, - = rest; each character is an eighth note.
// Default practice session: 10 minutes, accelerating from 80 to 240 BPM.
// Run: node examples/metronome.js 120 X-x-X-x-
// Run: node examples/metronome.js 80..240 10m X-x-x-x-
// Run: node examples/metronome.js bpm=90 -d 30s pat=X-x-x- sound=wood
//   Waltz: X-x-x-   Rock: X-x-X-x-   Reggaeton: X--x--x-
// Keys: space pause · ←/→ tempo ±2 BPM · ↑/↓ cycle sound · t tap-tempo · q quit

import { AudioContext } from 'web-audio-api'
import { createInstrument } from './graphs/metronome.js'
import { args, num, sec, keys, status, clearLine, pausedTag, help } from './utils.js'

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

let wantedSound = String($('sound', 'classic')).toLowerCase()
let ctx = new AudioContext()
await ctx.resume()
let instrument = createInstrument(ctx, { sound: wantedSound, hi, lo })
let click = instrument.hit

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
  render(`♩ ${curBpm.toFixed(1).padStart(6)} · [${pat.join('')}] · ${instrument.name.padEnd(10)} ${bar} ${(p * 100).toFixed(0).padStart(3)}%${pausedTag(ctx)}`)
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
  up: () => instrument.cycle(1),
  down: () => instrument.cycle(-1),
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
