// Drone: Play a tanpura, pad, shruti, harmonic drone, or cinematic strings, with an optional slow melody.
// CLI: npx web-audio-api drone C3 30s
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function seeded(seed = 0x44524f4e) {
  let state = seed >>> 0
  return () => {
    state += 0x6D2B79F5
    let n = state
    n = Math.imul(n ^ n >>> 15, n | 1)
    n ^= n + Math.imul(n ^ n >>> 7, n | 61)
    return ((n ^ n >>> 14) >>> 0) / 4294967296
  }
}

function safeStop(source, time) {
  try { source.stop(time) } catch { return }
}

// Room: a stereo impulse response of decorrelated noise whose tail darkens as it decays, the
// way a real room loses its highs first. Seeded, so a render repeats.
function roomIR(ctx, random, seconds = 1.8) {
  let length = Math.ceil(ctx.sampleRate * seconds)
  let buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let channel = 0; channel < 2; channel++) {
    let data = buffer.getChannelData(channel), smooth = 0
    for (let i = 0; i < length; i++) {
      let t = i / length
      let k = 1 - 0.94 * Math.sqrt(t) // one-pole coefficient: open at the start, closing over the tail
      smooth += k * ((random() * 2 - 1) - smooth)
      data[i] = smooth * Math.exp(-6.9 * t) * (1 - Math.exp(-i / 40))
    }
  }
  return buffer
}

let pan = (ctx, value) => {
  let panner = ctx.createStereoPanner()
  panner.pan.value = value
  return panner
}

let lfo = (ctx, { rate, depth, when, duration, target, type = 'sine', sources, nodes }) => {
  let osc = ctx.createOscillator(), gain = ctx.createGain()
  osc.type = type; osc.frequency.value = rate
  gain.gain.value = depth
  osc.connect(gain).connect(target)
  osc.start(when); safeStop(osc, when + duration + 0.05)
  sources.push(osc); nodes.push(osc, gain)
  return osc
}

// Tanpura: four strings, Pa (a fourth below Sa), Sa, Sa a few cents sharp, and SA an octave
// down, plucked in turn round and round as the instrument is played. Each pluck is an additive
// string whose partials carry two envelopes: the pluck itself, bright then settling as the
// highs die, and the jvari, the buzz of the curved bridge, which blooms as a formant sweeping
// up through the harmonics over the first seconds. Strings sit across the stereo field and
// pass through the resonances of the gourd.
function buildTanpura(ctx, { frequency, duration, when, random, bus, sources, nodes }) {
  let body = ctx.createBiquadFilter()
  body.type = 'peaking'; body.frequency.value = 230; body.Q.value = 1.4; body.gain.value = 5
  let body2 = ctx.createBiquadFilter()
  body2.type = 'peaking'; body2.frequency.value = 540; body2.Q.value = 2; body2.gain.value = 3
  let shelf = ctx.createBiquadFilter()
  shelf.type = 'highshelf'; shelf.frequency.value = 4200; shelf.gain.value = -4
  body.connect(body2).connect(shelf).connect(bus)
  nodes.push(body, body2, shelf)

  let strings = [
    { ratio: 0.75, cents: 0, pan: -0.4 },                 // Pa
    { ratio: 1, cents: 0, pan: -0.14 },                   // Sa
    { ratio: 1, cents: 2.5 + random() * 3, pan: 0.14 },   // Sa, a few cents sharp: the two beat slowly
    { ratio: 0.5, cents: 0, pan: 0.4 },                   // SA, the low octave
  ]
  let panners = strings.map(string => { let panner = pan(ctx, string.pan); panner.connect(body); nodes.push(panner); return panner })
  let stretch = strings.map(() => 0.00004 + random() * 0.00006) // slight inharmonicity, per string
  let currentFrequency = frequency
  const active = new Map()
  let cycle = 4.8 + random() * 0.8 // seconds per Pa Sa Sa SA round
  let ring = cycle * 1.35
  let points = 96

  let pluck = (index, time, strength) => {
    let string = strings[index]
    let base = currentFrequency * string.ratio * 2 ** (string.cents / 1200)
    let harmonics = Math.min(24, Math.floor(Math.min(5000, ctx.sampleRate * 0.42) / base))
    let position = 0.16 + random() * 0.05 // plucking point as a fraction of the string
    let sweepRate = 0.9 + random() * 0.4, jvari = 0.2 + random() * 0.08 // seconds for the buzz to climb, and its strength
    let attack = 0.006
    for (let h = 1; h <= harmonics; h++) {
      let osc = ctx.createOscillator(), level = ctx.createGain()
      osc.frequency.value = base * h * Math.sqrt(1 + stretch[index] * h * h)
      let plucked = Math.abs(Math.sin(Math.PI * h * position)) / h ** 1.18 * (0.9 + random() * 0.2)
      let tau = ring / 2.6 / (1 + 0.08 * h ** 1.3) // higher partials of the pluck die first
      let curve = new Float32Array(points)
      for (let i = 0; i < points; i++) {
        let t = i / (points - 1) * ring
        // the jvari formant climbs from the low harmonics up to the teens, then rings on as it fades
        let centre = 2.5 + 12 * (1 - Math.exp(-t / sweepRate))
        let formant = Math.exp(-((Math.log(h) - Math.log(centre)) ** 2) / (2 * 0.5 ** 2))
        let buzz = jvari * formant * Math.exp(-t / 2.8) / h ** 0.35 * Math.min(1, t / 0.15)
        // The bridge contribution breathes; it is not a static organ partial.
        curve[i] = (plucked * Math.exp(-t / tau) + buzz * (0.9 + 0.1 * Math.sin(t * (3.1 + index * 0.19) + h))) * Math.sign(Math.sin(Math.PI * h * position))
      }
      curve[points - 1] = 0
      if (!curve.some(value => Math.abs(value) >= 0.002)) continue
      // A four-cent settle needs only control-rate updates; stop its inaudible tail.
      // Amplitude envelopes and interactive frequency glides remain audio-rate.
      osc.detune.automationRate = 'k-rate'
      osc.detune.setValueAtTime(4 * strength, time)
      osc.detune.setTargetAtTime(0, time + attack, 0.12)
      osc.detune.setValueAtTime(0, time + attack + 0.96)
      active.set(osc, osc.frequency.value / currentFrequency)
      level.gain.setValueAtTime(0, time)
      level.gain.linearRampToValueAtTime(curve[0] * strength, time + attack)
      level.gain.setValueCurveAtTime(curve.map(value => value * strength), time + attack, ring)
      osc.connect(level).connect(panners[index])
      osc.start(time); safeStop(osc, time + attack + ring + 0.02)
      osc.onended = () => {
        level.disconnect(); active.delete(osc)
        if (typeof ctx.startRendering !== 'function') {
          sources.splice(sources.indexOf(osc), 1)
          nodes.splice(nodes.indexOf(osc), 1); nodes.splice(nodes.indexOf(level), 1)
        }
      }
      sources.push(osc); nodes.push(osc, level)
    }
  }

  // Strings are plucked in turn, a quarter cycle apart, with a player's timing and touch
  let next = 0, order = 0
  let scheduleUntil = horizon => {
    while (next < horizon && next < duration) {
      let human = (random() - 0.5) * 0.05
      pluck(order % 4, when + Math.max(0, next + human), 0.9 + random() * 0.2)
      next += cycle / 4
      order++
    }
  }
  // Offline contexts render faster than wall clock, so every pluck is scheduled upfront;
  // live contexts get a rolling lookahead window, keeping the node count bounded however
  // long the drone runs
  if (typeof ctx.startRendering === 'function') scheduleUntil(duration)
  else {
    let lookahead = 6
    scheduleUntil(ctx.currentTime - when + lookahead)
    let timer = setInterval(() => {
      if (ctx.state === 'closed' || next >= duration) return clearInterval(timer)
      if (ctx.state !== 'running') return
      scheduleUntil(ctx.currentTime - when + lookahead)
    }, 1000)
  }

  let retune = (target, time = ctx.currentTime) => {
    currentFrequency = target
    for (const [osc, ratio] of active) osc.frequency.setTargetAtTime(target * ratio, time, 0.3)
  }
  return { retune, targetGain: 0.19, wet: 0.28 }
}

// Pad: a six-voice unison of detuned saws with a sub sine and quiet octave triangles, through
// a slowly wandering resonant low-pass, widened by a two-tap chorus, breathing very slowly.
// All modulation is audio-rate, so nothing ever steps.
function buildPad(ctx, { frequency, duration, when, random, bus, sources, nodes }) {
  let breathe = ctx.createGain(); breathe.gain.value = 0.86
  let filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'; filter.Q.value = 0.65; filter.frequency.value = frequency * 5.5
  let sum = ctx.createGain()
  sum.connect(filter)
  breathe.connect(bus)
  nodes.push(breathe, filter, sum)

  let oscillators = []
  const wave = ctx.createPeriodicWave(new Float32Array(17), Float32Array.from({ length: 17 }, (_, h) => h ? 1 / h ** 1.55 : 0))
  let voice = (ratio, cents, type, level, position) => {
    let osc = ctx.createOscillator(), gain = ctx.createGain(), panner = pan(ctx, position)
    if (type === 'sawtooth') osc.setPeriodicWave(wave)
    else osc.type = type
    osc.frequency.value = frequency * ratio; osc.detune.value = cents
    lfo(ctx, { rate: 0.04 + random() * 0.08, depth: 2.2, when, duration, target: osc.detune, sources, nodes })
    gain.gain.value = level
    osc.connect(gain).connect(panner).connect(sum)
    osc.start(when); safeStop(osc, when + duration + 0.05)
    sources.push(osc); nodes.push(osc, gain, panner)
    oscillators.push({ osc, ratio })
  }
  for (let [i, cents] of [-14, -8, -3, 3, 8, 14].entries()) voice(1, cents + (random() - 0.5) * 2, 'sawtooth', 0.17, (i % 2 ? 1 : -1) * (0.25 + Math.abs(cents) / 40))
  voice(0.5, 0, 'sine', 0.27, 0)
  voice(2, -5, 'triangle', 0.07, -0.5)
  voice(2, 5, 'triangle', 0.07, 0.5)

  // chorus: the filtered sum plus two slowly modulated delay taps panned apart
  let dry = ctx.createGain(); dry.gain.value = 0.7
  filter.connect(dry).connect(breathe)
  nodes.push(dry)
  for (let [time, rate, position] of [[0.013, 0.21, -0.75], [0.021, 0.29, 0.75]]) {
    let delay = ctx.createDelay(0.05), tap = ctx.createGain(), panner = pan(ctx, position)
    delay.delayTime.value = time
    tap.gain.value = 0.45
    filter.connect(delay).connect(tap).connect(panner).connect(breathe)
    lfo(ctx, { rate: rate + random() * 0.05, depth: 0.0025, when, duration, target: delay.delayTime, sources, nodes })
    nodes.push(delay, tap, panner)
  }

  lfo(ctx, { rate: 0.012 + random() * 0.012, depth: frequency * 2.2, when, duration, target: filter.frequency, sources, nodes })
  lfo(ctx, { rate: 0.02 + random() * 0.02, depth: 0.12, when, duration, target: breathe.gain, sources, nodes })

  let retune = (target, time = ctx.currentTime) => {
    for (let { osc, ratio } of oscillators) osc.frequency.setTargetAtTime(target * ratio, time, 0.4)
    filter.frequency.setTargetAtTime(target * 5.5, time, 0.4)
  }
  return { retune, targetGain: 0.15, wet: 0.35 }
}

// Shruti: free reeds, as in a hand-pumped shruti box, sounding Sa, Pa, and the upper Sa. Each
// reed is a pair of saws a few cents apart through a reed formant, the whole box pumped by a
// slow bellows that leans on the level and the pitch together, with a little breath.
function buildShruti(ctx, { frequency, duration, when, random, bus, sources, nodes }) {
  let bellows = ctx.createGain(); bellows.gain.value = 0.9
  let formant = ctx.createBiquadFilter()
  formant.type = 'peaking'; formant.frequency.value = 1150; formant.Q.value = 1.6; formant.gain.value = 6
  let ceiling = ctx.createBiquadFilter()
  ceiling.type = 'lowpass'; ceiling.frequency.value = 4600; ceiling.Q.value = 0.5
  formant.connect(ceiling).connect(bellows).connect(bus)
  nodes.push(bellows, formant, ceiling)

  let oscillators = []
  for (let [ratio, level, position] of [[1, 1, 0], [1.5, 0.55, -0.3], [2, 0.3, 0.3]]) {
    let panner = pan(ctx, position); panner.connect(formant); nodes.push(panner)
    for (let side of [-1, 1]) {
      let osc = ctx.createOscillator(), gain = ctx.createGain()
      osc.type = 'sawtooth'; osc.frequency.value = frequency * ratio
      osc.detune.value = side * (2 + random() * 2)
      gain.gain.value = level * 0.14
      osc.connect(gain).connect(panner)
      osc.start(when); safeStop(osc, when + duration + 0.05)
      sources.push(osc); nodes.push(osc, gain)
      oscillators.push({ osc, ratio })
    }
  }
  // breath: a whisper of band-passed noise pumped with the bellows
  let noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 2), ctx.sampleRate)
  let data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = random() * 2 - 1
  let breath = ctx.createBufferSource(), breathBand = ctx.createBiquadFilter(), breathLevel = ctx.createGain()
  breath.buffer = noiseBuffer; breath.loop = true
  breathBand.type = 'bandpass'; breathBand.frequency.value = 1400; breathBand.Q.value = 0.6
  breathLevel.gain.value = 0.012
  breath.connect(breathBand).connect(breathLevel).connect(bellows)
  breath.start(when); safeStop(breath, when + duration + 0.05)
  sources.push(breath); nodes.push(breath, breathBand, breathLevel)

  let pump = lfo(ctx, { rate: 0.27 + random() * 0.08, depth: 0.08, when, duration, target: bellows.gain, sources, nodes })
  let sag = ctx.createGain(); sag.gain.value = 1.5 // cents of pitch lean per bellows stroke
  pump.connect(sag)
  for (let { osc } of oscillators) sag.connect(osc.detune)
  nodes.push(sag)

  let retune = (target, time = ctx.currentTime) => { for (let { osc, ratio } of oscillators) osc.frequency.setTargetAtTime(target * ratio, time, 0.3) }
  return { retune, targetGain: 0.24, wet: 0.22 }
}

// Harmonic: four detuned harmonic banks, fifth, unison, near-unison, and octave below, ten
// partials each, every bank breathing at its own slow rate and sitting in its own place.
function buildHarmonic(ctx, { frequency, duration, when, random, bus, sources, nodes }) {
  let voices = []
  for (let [ratio, position] of [[1.5, -0.5], [1, -0.15], [1.001, 0.15], [0.5, 0.5]]) {
    let bank = ctx.createGain(), panner = pan(ctx, position)
    bank.gain.value = 0.8
    bank.connect(panner).connect(bus)
    nodes.push(bank, panner)
    lfo(ctx, { rate: 0.04 + random() * 0.1, depth: 0.2, when, duration, target: bank.gain, sources, nodes })
    for (let harmonic = 1; harmonic <= 10; harmonic++) {
      let osc = ctx.createOscillator(), level = ctx.createGain()
      let jitter = 1 + (random() - 0.5) * 0.0005
      osc.frequency.value = frequency * ratio * harmonic * jitter
      level.gain.value = harmonic <= 3 ? 1 / harmonic : 0.7 / harmonic
      osc.connect(level).connect(bank)
      osc.start(when); safeStop(osc, when + duration + 0.05)
      sources.push(osc); nodes.push(osc, level)
      voices.push({ osc, ratio, harmonic, jitter })
    }
  }
  let retune = (target, time = ctx.currentTime) => { for (let voice of voices) voice.osc.frequency.setTargetAtTime(target * voice.ratio * voice.harmonic * voice.jitter, time, 0.3) }
  return { retune, targetGain: 0.055, wet: 0.3 }
}

// Bowed ensemble: independently phased players, body-shaped harmonics, separate
// bow-pressure and vibrato motion. Open fifths leave room for the optional melody.
function buildStrings(ctx, { frequency, duration, when, random, bus, sources, nodes }) {
  const players = []
  for (const [ratio, count, position] of [[0.5, 3, -0.45], [1, 4, -0.15], [1.5, 3, 0.25], [2, 3, 0.55]]) {
    for (let player = 0; player < count; player++) {
      const osc = ctx.createOscillator(), bow = ctx.createGain(), panner = pan(ctx, position + (random() - 0.5) * 0.2), pressure = ctx.createGain()
      pressure.gain.value = 0.9
      const real = new Float32Array(33), imag = new Float32Array(33), phase = random() * Math.PI * 2
      for (let h = 1; h < imag.length && frequency * ratio * h < ctx.sampleRate * 0.42; h++) {
        const hz = frequency * ratio * h
        const body = 0.6 + 0.8 * Math.exp(-((Math.log(hz / 500)) ** 2) / 0.6) + 0.45 * Math.exp(-((Math.log(hz / 2200)) ** 2) / 0.25)
        const amplitude = body / h ** 1.15
        real[h] = amplitude * Math.sin(h * phase); imag[h] = amplitude * Math.cos(h * phase)
      }
      osc.setPeriodicWave(ctx.createPeriodicWave(real, imag))
      osc.frequency.value = frequency * ratio
      osc.detune.value = (player - (count - 1) / 2) * 4 + (random() - 0.5) * 3
      const attack = Math.min(0.45 + random() * 0.3, duration / 3)
      bow.gain.setValueAtTime(0, when)
      bow.gain.linearRampToValueAtTime(0.1, when + attack)
      osc.connect(bow).connect(panner).connect(pressure).connect(bus)
      lfo(ctx, { rate: 4.6 + random(), depth: 5 + random() * 3, when, duration, target: osc.detune, sources, nodes })
      lfo(ctx, { rate: 0.035 + random() * 0.055, depth: 2.5, when, duration, target: osc.detune, sources, nodes })
      // Multiplicative bow pressure, so the modulation cannot leak through the attack.
      lfo(ctx, { rate: 0.08 + random() * 0.08, depth: 0.1, when, duration, target: pressure.gain, sources, nodes })
      osc.start(when); safeStop(osc, when + duration + 0.05)
      sources.push(osc); nodes.push(osc, bow, panner, pressure)
      players.push({ osc, ratio })
    }
  }
  const friction = ctx.createBufferSource(), band = ctx.createBiquadFilter(), air = ctx.createGain()
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 1.7), ctx.sampleRate), samples = buffer.getChannelData(0)
  for (let i = 0; i < samples.length; i++) samples[i] = (random() * 2 - 1) * Math.min(1, i / 96, (samples.length - 1 - i) / 96)
  friction.buffer = buffer; friction.loop = true
  band.type = 'bandpass'; band.frequency.value = 1900; band.Q.value = 0.55
  air.gain.value = 0.015
  friction.connect(band).connect(air).connect(bus)
  friction.start(when); safeStop(friction, when + duration + 0.05)
  sources.push(friction); nodes.push(friction, band, air)
  return {
    retune: (target, time = ctx.currentTime) => { for (const { osc, ratio } of players) osc.frequency.setTargetAtTime(target * ratio, time, 0.6) },
    targetGain: 0.28, wet: 0.45,
  }
}

function buildMelody(ctx, { frequency, duration, when, random, bus, sources, nodes, mode }) {
  const scale = mode === 'dorian' ? [0, 2, 3, 5, 7, 9, 10] : [0, 2, 4, 7, 9]
  const motif = [0, 2, 1, 3, 2, 1, 3, 0], notes = [], active = new Map()
  let base = frequency, next = 2, index = 0
  const scheduleUntil = horizon => {
    while (next < horizon && next < duration - 0.5) {
      const degree = motif[index % motif.length] + (Math.floor(index / motif.length) % 2 ? 1 : 0)
      const interval = scale[degree % scale.length], ratio = 2 * 2 ** (interval / 12)
      const length = Math.min(index % 4 === 3 ? 4 : 2.2, duration - next)
      const time = when + next, out = ctx.createGain(), panner = pan(ctx, 0.08)
      out.gain.setValueAtTime(0, time)
      out.gain.linearRampToValueAtTime(0.3, time + Math.min(0.22, length / 3))
      out.gain.setValueAtTime(0.3, time + length * 0.65)
      out.gain.linearRampToValueAtTime(0, time + length)
      out.connect(panner).connect(bus)
      nodes.push(out, panner)
      let remaining = 3
      for (const [h, amount] of [[1, 0.8], [2, 0.14], [3, 0.035]]) {
        const osc = ctx.createOscillator(), level = ctx.createGain()
        osc.frequency.value = base * ratio * h
        osc.detune.setValueAtTime(-14, time); osc.detune.setTargetAtTime(0, time + 0.04, 0.12)
        level.gain.value = amount
        osc.connect(level).connect(out)
        osc.start(time); safeStop(osc, time + length + 0.02)
        active.set(osc, ratio * h)
        osc.onended = () => {
          active.delete(osc); level.disconnect()
          if (typeof ctx.startRendering !== 'function') {
            sources.splice(sources.indexOf(osc), 1)
            nodes.splice(nodes.indexOf(osc), 1); nodes.splice(nodes.indexOf(level), 1)
          }
          if (!--remaining) {
            out.disconnect(); panner.disconnect()
            if (typeof ctx.startRendering !== 'function') {
              nodes.splice(nodes.indexOf(out), 1); nodes.splice(nodes.indexOf(panner), 1)
            }
          }
        }
        sources.push(osc); nodes.push(osc, level)
      }
      notes.push({ time, length, interval })
      next += length + (index % 4 === 3 ? 2 : 0.2 + random() * 0.2)
      index++
    }
  }
  if (typeof ctx.startRendering === 'function') scheduleUntil(duration)
  else {
    scheduleUntil(ctx.currentTime - when + 6)
    const timer = setInterval(() => {
      if (ctx.state === 'closed' || next >= duration - 0.5) return clearInterval(timer)
      if (ctx.state === 'running') scheduleUntil(ctx.currentTime - when + 6)
    }, 500)
  }
  return { notes, retune: (target, time = ctx.currentTime) => {
    base = target
    for (const [osc, ratio] of active) osc.frequency.setTargetAtTime(target * ratio, time, 0.4)
  } }
}

const voices = { tanpura: buildTanpura, pad: buildPad, shruti: buildShruti, harmonic: buildHarmonic, strings: buildStrings }

export function init(ctx, {
  frequency = 130.81, duration = 5, seed = 0x44524f4e, voice = 'tanpura', melody = 'off', when = ctx.currentTime,
  destination = ctx.destination,
} = {}) {
  if (!(frequency > 0) || !Number.isFinite(frequency) || !(duration > 0) || !Number.isFinite(duration)) throw new RangeError('Positive finite frequency and duration required')
  let random = seeded(seed)
  let sources = [], nodes = []
  let master = ctx.createGain(); master.gain.value = 0.0001
  master.connect(destination)
  // every voice plays into the same seeded room: dry and a darkening tail in parallel
  let bus = ctx.createGain(), dry = ctx.createGain(), room = ctx.createConvolver(), wet = ctx.createGain()
  room.buffer = roomIR(ctx, random)
  bus.connect(dry).connect(master)
  bus.connect(room).connect(wet).connect(master)
  nodes.push(master, bus, dry, room, wet)

  if (!Object.hasOwn(voices, voice)) voice = 'tanpura'
  let build = voices[voice]
  let { retune, targetGain, wet: wetLevel } = build(ctx, { frequency, duration, when, random, bus, sources, nodes })
  wet.gain.value = wetLevel
  const line = melody === 'off' ? null : buildMelody(ctx, { frequency, duration, when, random, bus, sources, nodes, mode: melody })

  // Every level change is ramped: no sample-to-sample steps at fade-in, fade-out, or start
  let fadeIn = Math.min(2.5, duration / 3)
  let fadeOutTime = Math.min(1.8, duration / 4)
  master.gain.setValueAtTime(0.0001, when)
  master.gain.exponentialRampToValueAtTime(targetGain, when + fadeIn)
  let end = when + duration, fadeStart = Math.max(when + fadeIn, end - fadeOutTime)
  master.gain.setValueAtTime(targetGain, fadeStart)
  master.gain.exponentialRampToValueAtTime(0.0001, end - Math.min(0.01, fadeOutTime / 2))
  master.gain.linearRampToValueAtTime(0, end)

  return {
    sources, nodes, duration,
    graph: 'Seeded voice bank and optional melody → Stereo room → Master Gain → Destination',
    data: { master, melody: line?.notes || [], voice, retune: (next, time = ctx.currentTime) => {
      if (!(next > 0) || !Number.isFinite(next)) throw new RangeError('Positive finite frequency required')
      retune(next, time); line?.retune(next, time)
    } },
  }
}
