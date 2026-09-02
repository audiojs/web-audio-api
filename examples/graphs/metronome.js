// Metronome: Schedule a click pattern with accents, rests, tempo control, and instrument presets.
// CLI: npx web-audio-api metronome 120 X-x-X-x-
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function seeded(seed = 0x4d455452) {
  let state = seed >>> 0
  return () => {
    state += 0x6D2B79F5
    let n = state
    n = Math.imul(n ^ n >>> 15, n | 1)
    n ^= n + Math.imul(n ^ n >>> 7, n | 61)
    return ((n ^ n >>> 14) >>> 0) / 4294967296
  }
}

export const soundNames = ['classic', 'wood', 'bell', 'beep', 'signal', 'karatala']

// Every preset is a small physical sketch: a struck body is a few decaying modes (sines at
// fixed ratios, the higher ones dying first) plus the broadband transient of the contact
// itself. Every level change is ramped, so the only click is the one the instrument makes.
export function createInstrument(ctx, {
  sound = 'classic', hi = 1900, lo = 1250, seed = 0x4d455452, sample = null,
  destination = ctx.destination, track = false,
} = {}) {
  let soundIndex = Math.max(0, soundNames.findIndex(name => name.startsWith(String(sound).toLowerCase())))
  let random = seeded(seed)
  let sources = [], nodes = []
  let master = ctx.createGain()
  master.gain.value = 0.7
  master.connect(destination)
  if (track) nodes.push(master)

  let noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate), ctx.sampleRate)
  let noise = noiseBuffer.getChannelData(0)
  for (let i = 0; i < noise.length; i++) noise[i] = random() * 2 - 1

  let remember = (...items) => { if (track) nodes.push(...items) }
  let rememberSource = source => { if (track) sources.push(source) }
  let releaseOnEnd = (source, tail) => { source.onended = () => tail.disconnect() }
  let ceiling = ctx.sampleRate * 0.45
  let velocity = 1 // per-hit scale set by hit(); layered rhythms window their hits through it

  // Contact transient: a filtered noise burst, a fraction of a millisecond of onset so the
  // burst itself never steps
  let noiseHit = (when, frequency, duration, level, type = 'bandpass', q = 0.7) => {
    let burst = ctx.createBufferSource()
    let filter = ctx.createBiquadFilter()
    let envelope = ctx.createGain()
    burst.buffer = noiseBuffer
    filter.type = type
    filter.frequency.value = Math.min(ceiling, frequency)
    filter.Q.value = q
    envelope.gain.setValueAtTime(0, when)
    envelope.gain.linearRampToValueAtTime(level * velocity, when + 0.0003)
    envelope.gain.exponentialRampToValueAtTime(0.0005, when + duration)
    burst.connect(filter).connect(envelope).connect(master)
    releaseOnEnd(burst, envelope)
    burst.start(when, random() * Math.max(0, noiseBuffer.duration - duration))
    burst.stop(when + duration)
    rememberSource(burst); remember(burst, filter, envelope)
  }

  // Struck body: modes as [ratio, amount, decay share, cents]. The mode decays over
  // `duration * share`, so higher partials can die before the fundamental. `knock` is a
  // short downward pitch settle right after impact, the way a struck bar or block speaks.
  let modalHit = (when, frequency, duration, level, modes, { attack = 0.0008, knock = 0 } = {}) => {
    let body = ctx.createGain()
    body.gain.setValueAtTime(0, when)
    body.gain.linearRampToValueAtTime(level * velocity, when + attack)
    body.connect(master)
    remember(body)
    let longest = null, longestEnd = 0
    for (let [ratio, amount, share = 1, cents = 0] of modes) {
      let osc = ctx.createOscillator()
      let partial = ctx.createGain()
      let target = Math.min(ceiling, frequency * ratio * 2 ** (cents / 1200))
      if (knock) {
        osc.frequency.setValueAtTime(target * (1 + knock), when)
        osc.frequency.exponentialRampToValueAtTime(target, when + 0.012)
      } else osc.frequency.value = target
      let end = when + attack + duration * share
      partial.gain.setValueAtTime(amount, when)
      partial.gain.exponentialRampToValueAtTime(amount * 0.001, end)
      osc.connect(partial).connect(body)
      osc.start(when); osc.stop(end + 0.005)
      if (end > longestEnd) { longestEnd = end; longest = osc }
      rememberSource(osc); remember(osc, partial)
    }
    if (longest) releaseOnEnd(longest, body)
  }

  // Mechanical metronome: the pendulum arm strikes the wooden case. A sharp contact tick,
  // a short case resonance at hi/lo, and a low knock from the box.
  let classic = (when, strong, frequency) => {
    noiseHit(when, 3200, 0.004, strong ? 0.22 : 0.14, 'highpass', 0.8)
    modalHit(when, frequency, strong ? 0.034 : 0.026, strong ? 0.3 : 0.2, [[1, 1], [1.58, 0.35, 0.7], [2.41, 0.12, 0.5]], { attack: 0.0005 })
    modalHit(when, frequency * 0.21, 0.02, strong ? 0.12 : 0.08, [[1, 1]], { attack: 0.0006, knock: 0.15 })
  }

  // Woodblock: a slotted hardwood bar, modes in the classic 1 : 1.6 : 2.4 spread, the mallet
  // contact low-passed by the wood, a quick pitch settle on impact.
  let wood = (when, strong, frequency) => {
    modalHit(when, frequency, strong ? 0.12 : 0.085, strong ? 0.34 : 0.24, [[1, 1], [1.62, 0.42, 0.55], [2.35, 0.18, 0.35], [3.1, 0.07, 0.25]], { attack: 0.0006, knock: 0.03 })
    noiseHit(when, 3400, 0.007, strong ? 0.1 : 0.06, 'lowpass', 0.5)
  }

  // Small bell: a stack of near-harmonic partials with the higher ones dying first, and a
  // doubled fundamental a few cents apart, so the tail shimmers instead of ringing dead.
  let bell = (when, strong, frequency) => {
    modalHit(when, frequency, strong ? 0.55 : 0.32, strong ? 0.17 : 0.12,
      [[1, 0.55, 1, -2], [1, 0.55, 1, 2], [2.01, 0.42, 0.7], [2.74, 0.24, 0.5], [3.92, 0.12, 0.35], [5.4, 0.05, 0.25]], { attack: 0.001 })
    noiseHit(when, 6000, 0.003, strong ? 0.05 : 0.035, 'highpass', 0.7)
  }

  // Electronic metronome: a pure tone gated by a straight envelope, no glide, one millisecond
  // in and a few out, a whisper of third harmonic for presence.
  let beep = (when, strong, frequency) => {
    let duration = strong ? 0.06 : 0.045
    let envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0, when)
    envelope.gain.linearRampToValueAtTime((strong ? 0.24 : 0.15) * velocity, when + 0.001)
    envelope.gain.setValueAtTime((strong ? 0.24 : 0.15) * velocity, when + duration - 0.006)
    envelope.gain.linearRampToValueAtTime(0, when + duration)
    envelope.connect(master)
    remember(envelope)
    for (let [ratio, amount] of [[1, 1], [3, 0.05]]) {
      let osc = ctx.createOscillator()
      let partial = ctx.createGain()
      osc.frequency.value = Math.min(ceiling, frequency * ratio)
      partial.gain.value = amount
      osc.connect(partial).connect(envelope)
      osc.start(when); osc.stop(when + duration + 0.005)
      rememberSource(osc); remember(osc, partial)
      releaseOnEnd(osc, envelope)
    }
  }

  // Broadcast pip: a single sine with a two-millisecond trapezoid, accents run longer
  let signal = (when, strong, frequency) => {
    let duration = strong ? 0.1 : 0.05
    let osc = ctx.createOscillator()
    let envelope = ctx.createGain()
    osc.frequency.value = Math.min(ceiling, frequency)
    envelope.gain.setValueAtTime(0, when)
    envelope.gain.linearRampToValueAtTime((strong ? 0.5 : 0.3) * velocity, when + 0.002)
    envelope.gain.setValueAtTime((strong ? 0.5 : 0.3) * velocity, when + duration - 0.002)
    envelope.gain.linearRampToValueAtTime(0, when + duration)
    osc.connect(envelope).connect(master)
    osc.start(when); osc.stop(when + duration + 0.005)
    rememberSource(osc); remember(osc, envelope)
    releaseOnEnd(osc, envelope)
  }

  // Karatala: small hand cymbals. Bright inharmonic partials with the two lowest doubled a
  // few cents apart for shimmer, and a very fast metallic "chick". Accents ring open while
  // regular hits are damped short.
  let karatala = (when, strong, frequency) => {
    modalHit(when, frequency, strong ? 0.5 : 0.09, strong ? 0.15 : 0.11,
      [[1, 0.5, 1, -4], [1, 0.5, 1, 4], [1.47, 0.3, 0.8, -3], [1.47, 0.3, 0.8, 3], [2.09, 0.36, 0.6], [2.71, 0.22, 0.45], [3.63, 0.14, 0.35], [4.52, 0.07, 0.25]], { attack: 0.0007 })
    noiseHit(when, 5000, 0.005, strong ? 0.11 : 0.08, 'highpass', 1.5)
  }

  // Sample-triggered hit: plays the decoded AudioBuffer instead of a preset, per tick.
  // Accents are louder and a touch brighter; the pitch stays, as it would on a real drum.
  let sampleHit = (when, strong) => {
    let source = ctx.createBufferSource()
    let brightness = ctx.createBiquadFilter()
    let level = ctx.createGain()
    source.buffer = sample
    brightness.type = 'highshelf'; brightness.frequency.value = 3000; brightness.gain.value = strong ? 3 : 0
    level.gain.setValueAtTime(0, when)
    level.gain.linearRampToValueAtTime((strong ? 1 : 0.65) * velocity, when + 0.001)
    source.connect(brightness).connect(level).connect(master)
    releaseOnEnd(source, level)
    source.start(when)
    rememberSource(source); remember(source, brightness, level)
  }

  // hit(when, mark, level): X accent, x regular click, - or . rest; level scales the whole hit
  let hit = (when, mark, level = 1) => {
    if (mark === '-' || mark === '.') return
    let strong = mark === 'X'
    velocity = level
    if (sample) return sampleHit(when, strong)
    let name = soundNames[soundIndex]
    let frequencies = {
      classic: strong ? hi : lo,
      wood: strong ? 1400 : 900,
      bell: strong ? 1760 : 1174.66,
      beep: strong ? 1320 : 880,
      signal: 1000,
      karatala: 3200,
    }
    ;({ classic, wood, bell, beep, signal, karatala })[name](when, strong, frequencies[name])
  }

  return {
    hit,
    sources,
    nodes,
    get name() { return soundNames[soundIndex] },
    cycle(direction = 1) { soundIndex = (soundIndex + direction + soundNames.length) % soundNames.length },
  }
}

export function init(ctx, {
  bpm = '80..240', pattern = 'X-x-x-x-', duration = 600, sound = 'classic',
  hi = 1900, lo = 1250, seed = 0x4d455452, sample = null,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let [startBpm, endBpm] = String(bpm).split('..').map(Number)
  if (!Number.isFinite(startBpm) || startBpm <= 0) startBpm = 80
  if (!Number.isFinite(endBpm) || endBpm <= 0) endBpm = startBpm
  if (!pattern) pattern = 'X-x-x-x-'
  let instrument = createInstrument(ctx, { sound, hi, lo, seed, sample, destination, track: true })
  let elapsed = 0, step = 0
  let scheduleUntil = horizon => {
    while (elapsed < duration && elapsed < horizon) {
      let progress = Math.min(1, elapsed / Math.max(duration, 0.001))
      let tempo = startBpm + (endBpm - startBpm) * progress
      instrument.hit(when + elapsed, pattern[step % pattern.length])
      elapsed += 30 / Math.max(20, tempo)
      step++
    }
  }
  // Offline contexts render faster than wall clock, so everything is scheduled
  // upfront; live contexts get a rolling lookahead window, keeping the node
  // count bounded however long the run is
  if (typeof ctx.startRendering === 'function') scheduleUntil(duration)
  else {
    let lookahead = 8
    scheduleUntil(ctx.currentTime - when + lookahead)
    if (elapsed < duration) {
      let timer = setInterval(() => {
        if (ctx.state !== 'running' || elapsed >= duration) return clearInterval(timer)
        scheduleUntil(ctx.currentTime - when + lookahead)
      }, 1000)
    }
  }
  return {
    sources: instrument.sources,
    nodes: instrument.nodes,
    duration,
    graph: 'Shared metronome instrument → audio-clock scheduler → Destination',
    data: { instrument },
  }
}
