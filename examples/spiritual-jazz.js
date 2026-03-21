// Generative spiritual jazz — randomized modal progressions, pentatonic flute improvisation.
// Different every time. 4-5 minutes. Run: node examples/spiritual-jazz.js

import { AudioContext, AudioWorkletNode } from 'web-audio-api'

let bpm = 76 + (Math.random() * 16 | 0)
let beat = 60 / bpm
let bpc = 8 // beats per chord (2 bars)
let nChords = Math.ceil(270 / (bpc * beat)) // ~4.5 min
let duration = nChords * bpc * beat

let ctx = new AudioContext()
await ctx.resume()

await ctx.audioWorklet.addModule('data:text/javascript,' + encodeURIComponent(`
class N extends AudioWorkletProcessor {
  process(_, o) { for (let i = 0, d = o[0][0]; i < d.length; i++) d[i] = Math.random() * 2 - 1; return true }
}; registerProcessor('noise', N)`))

// --- Theory ---
let semi = (root, s) => root * 2 ** (s / 12)
let pick = a => a[Math.random() * a.length | 0]
let noteOf = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
let noteName = f => { let m = Math.round(12 * Math.log2(f / 440) + 69); return noteOf[m % 12] + (m / 12 - 1 | 0) }

// Modal movement weights: 4ths dominate (spiritual), half-steps add color
let moves = [5, 5, 5, 3, 3, -1, -1, 4, -2, 7, 1]
let m9 = [0, 3, 7, 10, 14] // m9 voicing
let penta = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22] // minor pentatonic, 2 octaves
let dorian = [0, 2, 3, 5, 7, 10, 12, 14] // dorian scale for walking bass

// Energy curve — peaks at 70%, creates intro/outro space
let energy = c => (c / nChords < 0.7 ? c / nChords / 0.7 : (1 - c / nChords) / 0.3) ** 0.7

// Chord progression — random walk with octave clamping
let D3 = 146.83, roots = [D3]
for (let i = 1; i < nChords; i++) {
  let r = roots[i - 1] * 2 ** (pick(moves) / 12)
  while (r > 250) r /= 2; while (r < 100) r *= 2
  roots.push(r)
}

// Walking bass — dorian scale, varied rhythm, chromatic approach to next root
let walkBass = (root, nextRoot, cs) => {
  let notes = [], pos = 0, t = 0

  while (t < bpc - 0.3) {
    let dur = pick([0.75, 1, 1, 1, 1.5, 2])
    if (t + dur > bpc) dur = bpc - t
    if (dur < 0.4) break

    // Occasional rest (not on beat 1)
    if (t > 0.5 && Math.random() < 0.1) { t += dur; continue }

    let s
    if (t < 0.1) { s = 0; pos = 0 } // root on beat 1
    else if (t >= bpc - 1.5 && nextRoot) {
      // Chromatic approach to next chord root
      let iv = Math.round(12 * Math.log2(nextRoot / root)) % 12 || 12
      s = iv + pick([-1, 1])
    } else {
      // Walk through dorian scale — slight upward bias
      pos += pick([-1, 1, 1, 0])
      pos = Math.max(0, Math.min(dorian.length - 1, pos))
      s = dorian[pos]
    }

    notes.push({ s, when: cs + t * beat, dur: dur * beat })
    t += dur
  }
  return notes
}

// Jazz melodic cells — common interval patterns from real solos (scale steps, not semitones).
// These are transposition-invariant: they work over any chord root.
let cells = [
  { name: 'run-up',    iv: [1, 1, 1, 1],     dur: [.5, .5, .5, .75] },   // ascending scale run
  { name: 'run-down',  iv: [-1, -1, -1, -1],  dur: [.5, .5, .5, .75] },   // descending run
  { name: 'enclosure', iv: [1, -2, 1],         dur: [.5, .5, 1] },         // above, below, target
  { name: '1-3-5',     iv: [2, 2],             dur: [.75, .75] },          // triad arpeggio up
  { name: '5-3-1',     iv: [-2, -2],           dur: [.75, .75] },          // triad arpeggio down
  { name: 'cry',       iv: [4, -1],            dur: [1.5, 1] },           // leap up, step back
  { name: 'turn',      iv: [1, -1, -1, 1],    dur: [.5, .5, .5, .5] },   // upper neighbor turn
  { name: 'pendulum',  iv: [2, -3, 2],         dur: [.75, .75, 1] },      // wide swing
]

// Melody improviser — Markov intervals, jazz cells, serial avoidance, motif repetition
let improvise = (root, cs, beats, e) => {
  let notes = [], pos = 4, lastIv = 0, motif = [], used = new Set()
  let t = cs + beat * (0.25 + Math.random() * 0.5)
  let end = cs + beats * beat - beat * 0.3
  if (e < 0.05) return notes // silence only at extreme low energy

  let restP = 0.25 * (1 - e * 0.5)
  let fastP = e * 0.4

  while (t < end) {
    // Breathe between phrases
    if (Math.random() < restP) {
      t += pick([0.75, 1, 1.5]) * beat
      motif = []
      continue
    }

    // Jazz cell — 25% chance to play a melodic pattern from the vocabulary
    if (Math.random() < 0.25) {
      let cell = pick(cells)
      // Cry only at high energy; runs more likely at high energy
      if (cell.name === 'cry' && e < 0.6) cell = pick(cells.slice(0, 5))
      let ok = true
      for (let i = 0; i < cell.iv.length; i++) {
        let np = pos + cell.iv[i]
        if (np < 0 || np >= penta.length) { ok = false; break }
      }
      if (ok) {
        for (let i = 0; i < cell.iv.length; i++) {
          pos = Math.max(0, Math.min(penta.length - 1, pos + cell.iv[i]))
          let dur = cell.dur[i] * beat
          if (t + dur > end) break
          notes.push({ f: semi(root * 2, penta[pos]), t, dur })
          t += dur
          used.add(penta[pos] % 12)
        }
        if (used.size >= 5) used.clear()
        motif = []
        continue
      }
    }

    // Motif repetition — replay last phrase fragment transposed
    if (motif.length >= 3 && Math.random() < 0.2) {
      for (let iv of motif) {
        pos = Math.max(0, Math.min(penta.length - 1, pos + iv))
        let dur = pick([0.5, 0.75]) * beat
        if (t + dur > end) break
        notes.push({ f: semi(root * 2, penta[pos]), t, dur })
        t += dur
      }
      motif = []; used.clear()
      continue
    }

    // Interval — Markov: step back after leap
    let iv
    if (Math.abs(lastIv) >= 3) iv = Math.random() < 0.8 ? -Math.sign(lastIv) : pick([-1, 1])
    else iv = Math.random() < 0.65 ? pick([-1, 1]) : pick([-2, 2, -3, 3])
    if (e > 0.8 && Math.random() < 0.15 && pos < 7) iv = pick([3, 4])

    // Serial pitch avoidance — prefer unused pitch classes (Schoenberg-lite)
    let newPos = Math.max(0, Math.min(penta.length - 1, pos + iv))
    let pc = penta[newPos] % 12
    if (used.has(pc) && Math.random() < 0.7) {
      let alt = Math.max(0, Math.min(penta.length - 1, pos + (iv > 0 ? iv + 1 : iv - 1)))
      if (!used.has(penta[alt] % 12)) newPos = alt
    }
    pos = newPos
    used.add(penta[pos] % 12)
    if (used.size >= 5) used.clear()

    lastIv = iv
    motif.push(iv)
    if (motif.length > 4) motif.shift()

    let dur = (Math.random() < fastP ? pick([0.25, 0.5]) : pick([0.5, 0.75, 1, 1.5, 2])) * beat
    if (t + dur > end) dur = Math.max(0.2 * beat, end - t)

    notes.push({ f: semi(root * 2, penta[pos]), t, dur })
    t += dur
  }
  return notes
}

let t0 = ctx.currentTime

// --- Audio chains ---
let padLp = ctx.createBiquadFilter()
padLp.type = 'lowpass'; padLp.Q.value = 0.5
let padOut = ctx.createGain(); padOut.gain.value = 0.06
padLp.connect(padOut).connect(ctx.destination)

let bassLp = ctx.createBiquadFilter()
bassLp.type = 'lowpass'; bassLp.frequency.value = 350
let bassOut = ctx.createGain(); bassOut.gain.value = 0.3
bassLp.connect(bassOut).connect(ctx.destination)

let vib = ctx.createOscillator(); vib.frequency.value = 5
let vibG = ctx.createGain(); vibG.gain.value = 4
vib.connect(vibG); vib.start(t0); vib.stop(t0 + duration)
let melOut = ctx.createGain(); melOut.gain.value = 0.22
melOut.connect(ctx.destination)

// --- Percussion chains (all share the noise worklet, gated by gain automation) ---
let noise = new AudioWorkletNode(ctx, 'noise')

// Ride cymbal: bandpass noise ~8kHz for metallic shimmer
let rideBp = ctx.createBiquadFilter()
rideBp.type = 'bandpass'; rideBp.frequency.value = 8000; rideBp.Q.value = 1.5
let rideG = ctx.createGain(); rideG.gain.value = 0
noise.connect(rideBp).connect(rideG).connect(ctx.destination)

// Hi-hat: highpass noise ~10kHz, very tight
let hhHp = ctx.createBiquadFilter()
hhHp.type = 'highpass'; hhHp.frequency.value = 10000
let hhG = ctx.createGain(); hhG.gain.value = 0
noise.connect(hhHp).connect(hhG).connect(ctx.destination)

// Ghost snare: bandpass noise ~300Hz, barely audible
let ghostBp = ctx.createBiquadFilter()
ghostBp.type = 'bandpass'; ghostBp.frequency.value = 300; ghostBp.Q.value = 2
let ghostG = ctx.createGain(); ghostG.gain.value = 0
noise.connect(ghostBp).connect(ghostG).connect(ctx.destination)

// Brush: highpass noise with LFO swoosh
let brushHp = ctx.createBiquadFilter()
brushHp.type = 'highpass'; brushHp.frequency.value = 6000
let brushG = ctx.createGain(); brushG.gain.value = 0.012
noise.connect(brushHp).connect(brushG).connect(ctx.destination)
let swoosh = ctx.createOscillator(); swoosh.type = 'triangle'
swoosh.frequency.value = bpm / 60 / 2 // half-note swoosh rhythm
let swooshG = ctx.createGain(); swooshG.gain.value = 0.018
swoosh.connect(swooshG).connect(brushG.gain)
swoosh.start(t0); swoosh.stop(t0 + duration)

// Kick: sine with pitch envelope (scheduled per hit)
let kickOut = ctx.createGain(); kickOut.gain.value = 1
kickOut.connect(ctx.destination)
let scheduleKick = (when) => {
  let osc = ctx.createOscillator()
  osc.frequency.setValueAtTime(150, when)
  osc.frequency.exponentialRampToValueAtTime(50, when + 0.08)
  let env = ctx.createGain()
  env.gain.setValueAtTime(0, when)
  env.gain.linearRampToValueAtTime(0.12, when + 0.005)
  env.gain.exponentialRampToValueAtTime(0.001, when + 0.25)
  osc.connect(env).connect(kickOut)
  osc.start(when); osc.stop(when + 0.3)
}

// Ride pattern per bar: classic "ding...ding-ga" swing
//   beat:  1      2    2+     3      4    4+
let ridePattern = [[0, false], [1, true], [1 + 2/3, false], [2, false], [3, true], [3 + 2/3, false]]

// --- Schedule chords ---
for (let c = 0; c < nChords; c++) {
  let root = roots[c], e = energy(c)
  let cs = t0 + c * bpc * beat, ce = cs + bpc * beat

  // Pad: m9 sawtooth — filter opens with energy
  padLp.frequency.setValueAtTime(700 + e * 500, cs)
  let detunes = [-5, 3, -2, 4, -3]
  for (let v = 0; v < 5; v++) {
    let osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = semi(root, m9[v])
    osc.detune.value = detunes[v]
    let env = ctx.createGain()
    env.gain.setValueAtTime(0, cs)
    env.gain.linearRampToValueAtTime(1, cs + beat)
    env.gain.setValueAtTime(1, ce - beat)
    env.gain.linearRampToValueAtTime(0, ce)
    osc.connect(env).connect(padLp)
    osc.start(cs); osc.stop(ce + 0.01)
  }

  // Walking bass
  let br = root / 2
  while (br > 120) br /= 2; while (br < 55) br *= 2
  let nextBr = c < nChords - 1 ? roots[c + 1] / 2 : null
  if (nextBr) { while (nextBr > 120) nextBr /= 2; while (nextBr < 55) nextBr *= 2 }

  for (let { s, when, dur } of walkBass(br, nextBr, cs)) {
    let osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = semi(br, s)
    let env = ctx.createGain()
    env.gain.setValueAtTime(0, when)
    env.gain.linearRampToValueAtTime(1, when + 0.02)
    env.gain.setValueAtTime(1, when + dur * 0.6)
    env.gain.exponentialRampToValueAtTime(0.01, when + dur * 0.95)
    osc.connect(env).connect(bassLp)
    osc.start(when); osc.stop(when + dur + 0.01)
  }

  // Flute solo
  for (let { f, t, dur } of improvise(root, cs, bpc, e)) {
    let atk = Math.min(0.12, dur * 0.3), rel = Math.min(0.15, dur * 0.3)

    let osc = ctx.createOscillator()
    osc.frequency.setValueAtTime(f - 8, t)
    osc.frequency.linearRampToValueAtTime(f, t + 0.06)
    vibG.connect(osc.frequency)

    let osc2 = ctx.createOscillator()
    osc2.frequency.setValueAtTime(f * 2 - 16, t)
    osc2.frequency.linearRampToValueAtTime(f * 2, t + 0.06)
    vibG.connect(osc2.frequency)
    let h = ctx.createGain(); h.gain.value = 0.15

    let env = ctx.createGain()
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(1, t + atk)
    env.gain.setValueAtTime(1, t + dur - rel)
    env.gain.linearRampToValueAtTime(0, t + dur)

    osc.connect(env); osc2.connect(h).connect(env)
    env.connect(melOut)
    osc.start(t); osc.stop(t + dur + 0.01)
    osc2.start(t); osc2.stop(t + dur + 0.01)
  }

  // Percussion — schedule per chord section (2 bars)
  for (let bar = 0; bar < bpc / 4; bar++) {
    let bs = cs + bar * 4 * beat

    // Ride: swing pattern "ding...ding-ga"
    for (let [b, accent] of ridePattern) {
      let when = bs + b * beat
      let vol = (accent ? 0.06 : 0.035) * (0.5 + e * 0.5)
      rideG.gain.setValueAtTime(vol, when)
      rideG.gain.exponentialRampToValueAtTime(0.001, when + (accent ? 0.15 : 0.1))
    }

    // Hi-hat on 2 & 4
    for (let b of [1, 3]) {
      let when = bs + b * beat
      hhG.gain.setValueAtTime(0.04 * e, when)
      hhG.gain.exponentialRampToValueAtTime(0.001, when + 0.06)
    }

    // Ghost snares — random, very soft
    for (let b = 0; b < 4; b++) {
      if (Math.random() < 0.2 * e) {
        let when = bs + (b + Math.random() * 0.5) * beat
        ghostG.gain.setValueAtTime(0.03 * e, when)
        ghostG.gain.exponentialRampToValueAtTime(0.001, when + 0.12)
      }
    }

    // Kick on beat 1 (soft, not every bar at low energy)
    if (e > 0.15 && (bar === 0 || Math.random() < e * 0.6))
      scheduleKick(bs)
  }
}

console.log(`♪ ${bpm} BPM, ${(duration / 60).toFixed(1)} min — ` + roots.map(r => noteName(r) + 'm').join(' → '))

setTimeout(() => ctx.close(), duration * 1000 + 500)
