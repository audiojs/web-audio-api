// Drone: Play a sustained tanpura, pad, shruti, or harmonic drone voice from seeded, continuously ramped oscillator banks.
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

// Small seeded exponential-decay impulse response for a soft room/air tail.
function airIR(ctx, random, seconds = 1.2) {
  let length = Math.ceil(ctx.sampleRate * seconds)
  let buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let channel = 0; channel < 2; channel++) {
    let data = buffer.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      let t = i / ctx.sampleRate
      data[i] = (random() * 2 - 1) * Math.exp(-4.5 * t / seconds)
    }
  }
  return buffer
}

// Tanpura: four strings tuned Pa (a fourth below Sa), Sa, Sa (a few cents apart), and low SA
// (an octave below). Each string is re-plucked on its own slow, seeded cycle; the jvari buzz is
// approximated as upper harmonics that bloom in after the attack and decay back to the fundamental.
function buildTanpura(ctx, { frequency, duration, when, random, master }) {
  let sources = [], nodes = []
  let bus = ctx.createGain(); bus.gain.value = 1
  let dry = ctx.createGain(); dry.gain.value = 1
  let air = ctx.createConvolver(); air.buffer = airIR(ctx, random)
  let airGain = ctx.createGain(); airGain.gain.value = 0.22
  bus.connect(dry).connect(master)
  bus.connect(air).connect(airGain).connect(master)
  nodes.push(bus, dry, air, airGain)

  let strings = [
    { ratio: 0.75, cents: 0 },               // Pa
    { ratio: 1, cents: 0 },                  // Sa
    { ratio: 1, cents: 3 + random() * 4 },   // Sa, a few cents sharp for slow beating
    { ratio: 0.5, cents: 0 },                // SA, low octave
  ]
  let harmonicsPerString = 8 + Math.floor(random() * 5) // 8..12
  let stretch = strings.map(() => 0.00006 + random() * 0.00009) // slight inharmonic stretch, per string
  let currentFrequency = frequency

  let pluckString = (index, time) => {
    let string = strings[index]
    let base = currentFrequency * string.ratio * 2 ** (string.cents / 1200)
    let ring = 5.2 + random() * 2.6 // roughly how long this pluck rings before the next one
    let body = ctx.createGain(); body.connect(bus); nodes.push(body)
    for (let h = 1; h <= harmonicsPerString; h++) {
      let inharmonic = Math.sqrt(1 + stretch[index] * h * h)
      let osc = ctx.createOscillator(), level = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = Math.min(ctx.sampleRate * 0.45, base * h * inharmonic)
      let fundamental = h === 1
      // upper partials bloom in after the pluck (jvari buzz), then settle back to the fundamental
      let bloom = fundamental ? 0 : 0.05 + (h / harmonicsPerString) * (0.35 + random() * 0.55)
      let peak = (fundamental ? 0.85 : 0.5 / h) * (0.85 + random() * 0.3)
      let decay = (fundamental ? ring * 1.1 : ring * (0.45 + 0.5 / h))
      level.gain.setValueAtTime(0.0001, time)
      level.gain.linearRampToValueAtTime(peak, time + bloom + 0.012)
      level.gain.exponentialRampToValueAtTime(0.0001, time + bloom + decay)
      osc.connect(level).connect(body)
      osc.start(time); safeStop(osc, time + bloom + decay + 0.05)
      sources.push(osc); nodes.push(osc, level)
    }
  }

  // All four strings sound together at the start (a strum), then each restrikes on its own cycle
  let strum = [0, 0.03 + random() * 0.02, 0.07 + random() * 0.02, 0.11 + random() * 0.02]
  let nextPluck = strings.map((_, i) => when + strum[i])
  for (let i = 0; i < strings.length; i++) pluckString(i, nextPluck[i])

  let scheduleUntil = horizon => {
    for (let i = 0; i < strings.length; i++) {
      while (true) {
        let upcoming = nextPluck[i] + (5.2 + random() * 2.6)
        if (upcoming >= horizon || upcoming >= when + duration) break
        nextPluck[i] = upcoming
        pluckString(i, nextPluck[i])
      }
    }
  }
  // Offline contexts render faster than wall clock, so every pluck is scheduled upfront;
  // live contexts get a rolling lookahead window, keeping the node count bounded however
  // long the drone runs
  if (typeof ctx.startRendering === 'function') scheduleUntil(when + duration)
  else {
    let lookahead = 10
    scheduleUntil(ctx.currentTime + lookahead)
    let timer = setInterval(() => {
      if (ctx.state !== 'running' || nextPluck.every(t => t >= when + duration)) return clearInterval(timer)
      scheduleUntil(ctx.currentTime + lookahead)
    }, 2500)
  }

  let retune = next => { currentFrequency = next } // takes effect from the next pluck on, like a real retune
  return { sources, nodes, retune, targetGain: 0.13 }
}

// Pad: a small detuned saw/triangle stack through a slowly wandering low-pass, sparse octave
// shimmer partials, and very slow amplitude breathing — all audio-rate modulation, no steps.
function buildPad(ctx, { frequency, duration, when, random, master }) {
  let sources = [], nodes = []
  let breathe = ctx.createGain(); breathe.gain.value = 0.88 // slow amplitude breathing sits here
  let filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'; filter.Q.value = 0.6; filter.frequency.value = frequency * 5
  filter.connect(breathe).connect(master)
  nodes.push(filter, breathe)

  let stack = [
    { ratio: 1, cents: -9 + random() * 4, type: 'sawtooth', level: 0.34 },
    { ratio: 1, cents: -3 + random() * 3, type: 'triangle', level: 0.3 },
    { ratio: 1, cents: 3 + random() * 3, type: 'triangle', level: 0.3 },
    { ratio: 1, cents: 9 + random() * 4, type: 'sawtooth', level: 0.34 },
  ]
  let oscillators = stack.map(voice => {
    let osc = ctx.createOscillator(), level = ctx.createGain()
    osc.type = voice.type
    osc.frequency.value = frequency * voice.ratio
    osc.detune.value = voice.cents
    level.gain.value = voice.level
    osc.connect(level).connect(filter)
    osc.start(when); safeStop(osc, when + duration + 0.05)
    sources.push(osc); nodes.push(osc, level)
    return osc
  })

  // sparse octave shimmer: quiet high partials that swell in and out on a very slow LFO each
  for (let shimmer of [{ ratio: 2, rate: 0.03 + random() * 0.02 }, { ratio: 4, rate: 0.02 + random() * 0.015 }]) {
    let osc = ctx.createOscillator(), level = ctx.createGain()
    osc.type = 'sine'; osc.frequency.value = frequency * shimmer.ratio
    level.gain.value = 0.05 // LFO output is bipolar around 0, so bias with the same offset
    let lfo = ctx.createOscillator(), lfoGain = ctx.createGain()
    lfo.type = 'sine'; lfo.frequency.value = shimmer.rate
    lfoGain.gain.value = 0.05
    lfo.connect(lfoGain).connect(level.gain)
    osc.connect(level).connect(filter)
    osc.start(when); lfo.start(when)
    safeStop(osc, when + duration + 0.05); safeStop(lfo, when + duration + 0.05)
    sources.push(osc, lfo); nodes.push(osc, level, lfo, lfoGain)
  }

  // slowly wandering cutoff, driven by an audio-rate LFO so there is never a discrete step
  let cutoffLfo = ctx.createOscillator(), cutoffDepth = ctx.createGain()
  cutoffLfo.type = 'sine'; cutoffLfo.frequency.value = 0.015 + random() * 0.015
  cutoffDepth.gain.value = frequency * 1.8
  cutoffLfo.connect(cutoffDepth).connect(filter.frequency)
  cutoffLfo.start(when); safeStop(cutoffLfo, when + duration + 0.05)
  sources.push(cutoffLfo); nodes.push(cutoffLfo, cutoffDepth)

  // very slow amplitude breathing, biased around the resting level set above
  let breatheLfo = ctx.createOscillator(), breatheDepth = ctx.createGain()
  breatheLfo.type = 'sine'; breatheLfo.frequency.value = 0.025 + random() * 0.02
  breatheDepth.gain.value = 0.12
  breatheLfo.connect(breatheDepth).connect(breathe.gain)
  breatheLfo.start(when); safeStop(breatheLfo, when + duration + 0.05)
  sources.push(breatheLfo); nodes.push(breatheLfo, breatheDepth)

  let retune = next => { for (let osc of oscillators) osc.frequency.setTargetAtTime(next, ctx.currentTime, 0.4) }
  return { sources, nodes, retune, targetGain: 0.16 }
}

// Shruti: reed-like sustained odd-harmonic banks (like a hand-pumped shruti box), with slow
// beating between closely detuned partial pairs.
function buildShruti(ctx, { frequency, duration, when, random, master }) {
  let sources = [], nodes = []
  let filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'; filter.Q.value = 0.8; filter.frequency.value = frequency * 9
  filter.connect(master)
  nodes.push(filter)

  let oddHarmonics = [1, 3, 5, 7, 9]
  let oscillators = []
  for (let h of oddHarmonics) {
    let level = 0.5 / h
    for (let pair of [-1, 1]) {
      let osc = ctx.createOscillator(), gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = frequency * h
      osc.detune.value = pair * (1.5 + random() * 2) // gentle detune pair, slow beating
      gain.gain.value = level * 0.5
      osc.connect(gain).connect(filter)
      osc.start(when); safeStop(osc, when + duration + 0.05)
      sources.push(osc); nodes.push(osc, gain)
      oscillators.push(osc)
    }
  }
  let retune = next => { for (let osc of oscillators) osc.frequency.setTargetAtTime(next * (osc.frequency.value / frequency), ctx.currentTime, 0.3) }
  return { sources, nodes, retune, targetGain: 0.3 }
}

// Harmonic: the original four-ratio detuned harmonic bank, refined into the shared voice contract.
function buildHarmonic(ctx, { frequency, duration, when, random, master }) {
  let sources = [], nodes = [], voices = []
  for (let ratio of [1.5, 1, 1.001, 0.5]) for (let harmonic = 1; harmonic <= 10; harmonic++) {
    let osc = ctx.createOscillator(), level = ctx.createGain()
    osc.frequency.value = frequency * ratio * harmonic * (1 + (random() - 0.5) * 0.0005)
    level.gain.value = harmonic <= 3 ? 1 / harmonic : 0.7 / harmonic
    osc.connect(level).connect(master)
    osc.start(when); safeStop(osc, when + duration + 0.05)
    sources.push(osc); nodes.push(osc, level); voices.push({ osc, harmonic, ratio })
  }
  let retune = next => { for (let voice of voices) voice.osc.frequency.setTargetAtTime(next * voice.ratio * voice.harmonic * (1 + (random() - 0.5) * 0.0005), ctx.currentTime, 0.08) }
  return { sources, nodes, retune, targetGain: 0.06 }
}

const voices = { tanpura: buildTanpura, pad: buildPad, shruti: buildShruti, harmonic: buildHarmonic }

export function init(ctx, {
  frequency = 130.81, duration = 5, seed = 0x44524f4e, voice = 'tanpura', when = ctx.currentTime,
  destination = ctx.destination,
} = {}) {
  let random = seeded(seed)
  let master = ctx.createGain(); master.gain.value = 0.0001
  master.connect(destination)
  let voiceBuilder = voices[voice] || buildTanpura
  let { sources, nodes, retune, targetGain } = voiceBuilder(ctx, { frequency, duration, when, random, master })

  // Every level change is ramped: no sample-to-sample steps at fade-in, fade-out, or start
  let fadeIn = Math.min(2.5, duration / 3)
  let fadeOutTime = Math.min(1.8, duration / 4)
  master.gain.setValueAtTime(0.0001, when)
  master.gain.exponentialRampToValueAtTime(targetGain, when + fadeIn)
  let end = when + duration, fadeStart = Math.max(when + fadeIn, end - fadeOutTime)
  master.gain.setValueAtTime(targetGain, fadeStart)
  master.gain.exponentialRampToValueAtTime(0.0001, end)

  return {
    sources, nodes: [master, ...nodes], duration,
    graph: 'Seeded voice bank (tanpura/pad/shruti/harmonic) → Master Gain → Destination',
    data: { master, retune: (next, time = ctx.currentTime) => retune(next, time), voice },
  }
}
