// Metronome — programmable click pattern (drum tab notation).
// X = accent, x = hit, - = rest.
// Run: node examples/metronome.js 120 X-x-X-x-
// Run: node examples/metronome.js 120..240 10m Xxx
// Run: node examples/metronome.js bpm=90 -d 30s pat=Xxx hi=1200 lo=600
//   Waltz: Xxx   Rock: X-x-X-x-   Reggaeton: X--x--x-
// Keys: space pause · ←/→ tempo ±2 BPM · ↑/↓ cycle sound · t tap-tempo · q quit

import { AudioContext } from 'web-audio-api'
import { args, num, sec, keys, status, clearLine, pausedTag } from './_util.js'

let { pos, $ } = args()

let bpmTok = pos.find(t => /^\d/.test(t) && !/[smh]$/.test(t))
let [bpm0, bpm1] = (bpmTok || $('bpm', '120')).toString().split('..').map(Number)
if (!bpm1) bpm1 = bpm0

let dur = sec(pos.find(t => /\d[smh]$/.test(t)) || $('dur', '60'))
let pat = (pos.find(t => /^[Xx.\-]+$/.test(t)) || $('pat', 'X-x-x-x-')).split('')
let hi = num($('hi', 800)), lo = num($('lo', 500))

// Sound presets: [accent-freq, ghost-freq, decay, sustain?, name]
let sounds = [
  { a: hi,   g: lo,   decay: 0.03,  sustain: false, name: 'click'   },
  { a: 1600, g: 800,  decay: 0.04,  sustain: false, name: 'wood'    },
  { a: 2400, g: 1200, decay: 0.06,  sustain: false, name: 'cowbell' },
  { a: 5000, g: 3000, decay: 0.015, sustain: false, name: 'tick'    },
  { a: 400,  g: 200,  decay: 0.08,  sustain: false, name: 'low'     },
  { a: 2500, g: 1800, decay: 0.06,  sustain: true,  name: 'beep'    },
  { a: 880,  g: 440,  decay: 0.07,  sustain: true,  name: 'signal'  },
]
let sIdx = 0

let ctx = new AudioContext()
await ctx.resume()

let click = (when, ch) => {
  if (ch === '-' || ch === '.') return
  let strong = ch === 'X'
  let s = sounds[sIdx]
  let f = strong ? s.a : s.g
  let osc = ctx.createOscillator()
  osc.type = s.sustain ? 'sine' : 'sine'
  osc.frequency.setValueAtTime(f, when)
  if (!s.sustain) osc.frequency.exponentialRampToValueAtTime(f * 0.5, when + s.decay / 3)
  let env = ctx.createGain()
  let peak = strong ? 0.6 : 0.25
  env.gain.setValueAtTime(0, when)
  env.gain.linearRampToValueAtTime(peak, when + 0.003)
  if (s.sustain) {
    env.gain.setValueAtTime(peak, when + s.decay - 0.02)
    env.gain.linearRampToValueAtTime(0, when + s.decay)
  } else {
    env.gain.exponentialRampToValueAtTime(0.001, when + s.decay)
  }
  osc.connect(env).connect(ctx.destination)
  osc.start(when); osc.stop(when + s.decay + 0.02)
}

let t0 = ctx.currentTime
let userOffset = 0
let tapTimes = []
let next = t0, i = 0
let curBpm = bpm0
let schedAhead = 0.15

let sched = setInterval(() => {
  if (ctx.state !== 'running') return
  while (next < ctx.currentTime + schedAhead && ctx.currentTime < t0 + dur) {
    let p = Math.min((next - t0) / dur, 1)
    curBpm = Math.max(20, bpm0 + (bpm1 - bpm0) * p + userOffset)
    click(next, pat[i % pat.length])
    next += 30 / curBpm
    i++
  }
}, 25)

let render = status()
let draw = () => {
  let p = Math.min((ctx.currentTime - t0) / dur, 1)
  let bar = '█'.repeat(Math.floor(p * 20)).padEnd(20, '░')
  render(`♩ ${curBpm.toFixed(1).padStart(6)} · [${pat.join('')}] · ${sounds[sIdx].name.padEnd(7)} ${bar} ${(p * 100).toFixed(0).padStart(3)}%${pausedTag(ctx)}`)
}
let ui = setInterval(draw, 50)

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
}, () => { clearInterval(sched); clearInterval(ui); clearLine(); ctx.close() }, ctx)

let header = bpm0 === bpm1 ? `♩ = ${bpm0}` : `♩ = ${bpm0}→${bpm1}`
console.log(`${header}  [${pat.join('')}]  (${dur}s)  space pause · ← → tempo · ↑ ↓ sound · t tap · q quit`)

setTimeout(() => { clearInterval(sched); clearInterval(ui); clearLine(); ctx.close(); process.exit(0) }, dur * 1000 + 200)
