// Spiritual jazz meditation — modal ostinato, warm chord pad, pentatonic melody, brush texture.
// Run: node examples/spiritual-jazz.js
// Browser: paste into DevTools console (uses native AudioContext)

import { AudioContext } from 'web-audio-api'
const bpm = 88
const beat = 60 / bpm
const bars = 4
const duration = bars * 4 * beat
const ctx = new AudioContext()
await ctx.resume()

let t = ctx.currentTime

// --- Bass ostinato: D Dorian root movement (triangle → lowpass) ---
let bassNotes = [73.42, 87.31, 98.00, 110.00] // D2 F2 G2 A2
let bassLp = ctx.createBiquadFilter()
bassLp.type = 'lowpass'
bassLp.frequency.value = 400

let bassOut = ctx.createGain()
bassOut.gain.value = 0.35
bassLp.connect(bassOut).connect(ctx.destination)

for (let bar = 0; bar < bars; bar++) {
  for (let i = 0; i < 4; i++) {
    let when = t + (bar * 4 + i) * beat
    let osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = bassNotes[i]

    let env = ctx.createGain()
    env.gain.setValueAtTime(0, when)
    env.gain.linearRampToValueAtTime(1, when + 0.02)
    env.gain.setValueAtTime(1, when + beat * 0.6)
    env.gain.exponentialRampToValueAtTime(0.01, when + beat * 0.95)

    osc.connect(env).connect(bassLp)
    osc.start(when)
    osc.stop(when + beat)
  }
}

// --- Pad: Dm9 → G9 (sawtooth → lowpass, slow swell, chord glides down) ---
let padLp = ctx.createBiquadFilter()
padLp.type = 'lowpass'
padLp.frequency.value = 800
padLp.Q.value = 0.7

let padOut = ctx.createGain()
padOut.gain.setValueAtTime(0, t)
padOut.gain.linearRampToValueAtTime(0.12, t + beat * 4)
padOut.gain.setValueAtTime(0.12, t + duration - beat * 2)
padOut.gain.linearRampToValueAtTime(0, t + duration)
padLp.connect(padOut).connect(ctx.destination)

let padFreqs1 = [146.83, 174.61, 220.00, 261.63, 329.63] // Dm9: D3 F3 A3 C4 E4
let padFreqs2 = [130.81, 164.81, 196.00, 246.94, 293.66] // Cmaj9: C3 E3 G3 B3 D4
let detunes = [-4, 3, -2, 5, -3]
let chordShift = t + 8 * beat // bar 3
for (let i = 0; i < padFreqs1.length; i++) {
  let osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(padFreqs1[i], t)
  osc.frequency.setValueAtTime(padFreqs1[i], chordShift)
  osc.frequency.linearRampToValueAtTime(padFreqs2[i], chordShift + beat * 0.5)
  osc.detune.value = detunes[i]
  osc.connect(padLp)
  osc.start(t)
  osc.stop(t + duration)
}

// --- Lead melody: flute-like tone (sine + 2nd harmonic, pitch scoop, vibrato) ---
let vibLfo = ctx.createOscillator()
vibLfo.frequency.value = 5
let vibDepth = ctx.createGain()
vibDepth.gain.value = 4 // ±4Hz vibrato
vibLfo.connect(vibDepth)
vibLfo.start(t)
vibLfo.stop(t + duration)

let melodyOut = ctx.createGain()
melodyOut.gain.value = 0.25
melodyOut.connect(ctx.destination)

//                freq    beat  dur — D4:293.66 F4:349.23 G4:392 A4:440 C5:523.25 D5:587.33
let melody = [
  [440,    4,    1.5],  // A4 — searching upward
  [523.25, 5.5,  1  ],  // C5
  [587.33, 6.5,  1.5],  // D5 — peak
  [523.25, 8,    2  ],  // C5 — descending answer
  [440,    10,   1  ],  // A4
  [392,    11,   1  ],  // G4
  [349.23, 12,   1  ],  // F4 — resolving
  [293.66, 13,   3  ],  // D4 — home
]

for (let [freq, startBeat, dur] of melody) {
  let when = t + startBeat * beat
  let len = dur * beat

  // Fundamental with pitch scoop (flute onset)
  let osc = ctx.createOscillator()
  osc.frequency.setValueAtTime(freq - 8, when)
  osc.frequency.linearRampToValueAtTime(freq, when + 0.06)
  vibDepth.connect(osc.frequency)

  // 2nd harmonic — gives body like a flute overblowing
  let osc2 = ctx.createOscillator()
  osc2.frequency.setValueAtTime(freq * 2 - 16, when)
  osc2.frequency.linearRampToValueAtTime(freq * 2, when + 0.06)
  vibDepth.connect(osc2.frequency)
  let harmGain = ctx.createGain()
  harmGain.gain.value = 0.15

  // Soft envelope (breathy attack)
  let env = ctx.createGain()
  env.gain.setValueAtTime(0, when)
  env.gain.linearRampToValueAtTime(1, when + 0.12)
  env.gain.setValueAtTime(1, when + len - 0.15)
  env.gain.linearRampToValueAtTime(0, when + len)

  osc.connect(env)
  osc2.connect(harmGain).connect(env)
  env.connect(melodyOut)
  osc.start(when); osc.stop(when + len + 0.01)
  osc2.start(when); osc2.stop(when + len + 0.01)
}

// --- Brush texture: noise buffer → highpass, subtle ---
let noiseLen = ctx.sampleRate * duration | 0
let noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
let noiseData = noiseBuf.getChannelData(0)
for (let i = 0; i < noiseLen; i++) noiseData[i] = Math.random() * 2 - 1

let noise = ctx.createBufferSource()
noise.buffer = noiseBuf

let brushHp = ctx.createBiquadFilter()
brushHp.type = 'highpass'
brushHp.frequency.value = 6000

let brushOut = ctx.createGain()
brushOut.gain.value = 0.04
noise.connect(brushHp).connect(brushOut).connect(ctx.destination)
noise.start(t)

setTimeout(() => ctx.close(), duration * 1000 + 500)
