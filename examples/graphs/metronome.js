// Programmable metronome: Schedule a click pattern with accents, rests, tempo control, and instrument presets.
// CLI: node examples/metronome.js 120 X-x-X-x-
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

export const soundNames = ['classic', 'wood', 'bell', 'beep', 'signal']

export function createInstrument(ctx, {
  sound = 'classic', hi = 1900, lo = 1250, seed = 0x4d455452,
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

  let noiseHit = (when, frequency, duration, level, type = 'bandpass', q = 0.7) => {
    let burst = ctx.createBufferSource()
    let filter = ctx.createBiquadFilter()
    let envelope = ctx.createGain()
    burst.buffer = noiseBuffer
    filter.type = type
    filter.frequency.value = Math.min(ctx.sampleRate * 0.4, frequency)
    filter.Q.value = q
    envelope.gain.setValueAtTime(level, when)
    envelope.gain.exponentialRampToValueAtTime(0.001, when + duration)
    burst.connect(filter).connect(envelope).connect(master)
    releaseOnEnd(burst, envelope)
    burst.start(when, random() * Math.max(0, noiseBuffer.duration - duration))
    burst.stop(when + duration)
    rememberSource(burst); remember(burst, filter, envelope)
  }

  let modalHit = (when, frequency, duration, level, modes, attack = 0) => {
    let body = ctx.createGain()
    if (attack) {
      body.gain.setValueAtTime(0, when)
      body.gain.linearRampToValueAtTime(level, when + attack)
    } else body.gain.setValueAtTime(level, when)
    body.gain.exponentialRampToValueAtTime(0.001, when + duration)
    body.connect(master)
    remember(body)
    let last
    for (let [ratio, amount, type = 'sine'] of modes) {
      let osc = last = ctx.createOscillator()
      let partial = ctx.createGain()
      osc.type = type
      osc.frequency.value = Math.min(ctx.sampleRate * 0.42, frequency * ratio)
      partial.gain.value = amount
      osc.connect(partial).connect(body)
      osc.start(when); osc.stop(when + duration + 0.01)
      rememberSource(osc); remember(osc, partial)
    }
    if (last) releaseOnEnd(last, body)
  }

  let classic = (when, strong, frequency) => {
    modalHit(when, frequency, strong ? 0.032 : 0.024, strong ? 0.29 : 0.18, [[1, 1], [1.58, 0.32]])
    noiseHit(when, frequency * 2.5, strong ? 0.009 : 0.006, strong ? 0.15 : 0.09, 'bandpass', 1.1)
  }

  let wood = (when, strong, frequency) => {
    modalHit(when, frequency, strong ? 0.11 : 0.08, strong ? 0.32 : 0.22, [[1, 1, 'triangle'], [1.47, 0.38], [2.09, 0.16]])
    noiseHit(when, frequency * 3.4, 0.012, strong ? 0.07 : 0.045, 'lowpass')
  }

  let bell = (when, strong, frequency) => {
    modalHit(when, frequency, strong ? 0.38 : 0.27, strong ? 0.15 : 0.1, [[1, 1], [2.01, 0.5], [2.73, 0.27], [3.92, 0.12]], 0.002)
  }

  let beep = (when, strong, frequency) => {
    let duration = strong ? 0.075 : 0.055
    let envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0, when)
    envelope.gain.linearRampToValueAtTime(strong ? 0.2 : 0.12, when + 0.002)
    envelope.gain.setValueAtTime(strong ? 0.2 : 0.12, when + duration - 0.012)
    envelope.gain.linearRampToValueAtTime(0, when + duration)
    envelope.connect(master)
    remember(envelope)
    for (let [ratio, amount, type] of [[1, 1, 'sine'], [2, 0.16, 'triangle']]) {
      let osc = ctx.createOscillator()
      let partial = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(frequency * ratio * 1.035, when)
      osc.frequency.exponentialRampToValueAtTime(frequency * ratio, when + 0.012)
      partial.gain.value = amount
      osc.connect(partial).connect(envelope)
      osc.start(when); osc.stop(when + duration + 0.005)
      rememberSource(osc); remember(osc, partial)
      releaseOnEnd(osc, envelope)
    }
  }

  let signal = (when, strong, frequency) => {
    let duration = 0.07
    let osc = ctx.createOscillator()
    let envelope = ctx.createGain()
    osc.frequency.value = frequency
    envelope.gain.setValueAtTime(0, when)
    envelope.gain.linearRampToValueAtTime(strong ? 0.6 : 0.25, when + 0.003)
    envelope.gain.setValueAtTime(strong ? 0.6 : 0.25, when + duration - 0.02)
    envelope.gain.linearRampToValueAtTime(0, when + duration)
    osc.connect(envelope).connect(master)
    osc.start(when); osc.stop(when + duration + 0.005)
    rememberSource(osc); remember(osc, envelope)
    releaseOnEnd(osc, envelope)
  }

  let hit = (when, mark) => {
    if (mark === '-' || mark === '.') return
    let strong = mark === 'X'
    let name = soundNames[soundIndex]
    let frequencies = {
      classic: strong ? hi : lo,
      wood: strong ? 1400 : 700,
      bell: strong ? 1760 : 880,
      beep: strong ? 1320 : 880,
      signal: strong ? 880 : 440,
    }
    ;({ classic, wood, bell, beep, signal })[name](when, strong, frequencies[name])
  }

  return {
    hit,
    sources,
    nodes,
    get name() { return soundNames[soundIndex] },
    cycle(direction = 1) { soundIndex = (soundIndex + direction + soundNames.length) % soundNames.length },
  }
}

export function build(ctx, {
  bpm = '80..240', pattern = 'X-x-x-x-', duration = 600, sound = 'classic',
  hi = 1900, lo = 1250, seed = 0x4d455452,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let [startBpm, endBpm] = String(bpm).split('..').map(Number)
  if (!Number.isFinite(startBpm) || startBpm <= 0) startBpm = 80
  if (!Number.isFinite(endBpm) || endBpm <= 0) endBpm = startBpm
  if (!pattern) pattern = 'X-x-x-x-'
  let instrument = createInstrument(ctx, { sound, hi, lo, seed, destination, track: true })
  let elapsed = 0, step = 0
  while (elapsed < duration) {
    let progress = Math.min(1, elapsed / Math.max(duration, 0.001))
    let tempo = startBpm + (endBpm - startBpm) * progress
    instrument.hit(when + elapsed, pattern[step % pattern.length])
    elapsed += 30 / Math.max(20, tempo)
    step++
  }
  return {
    sources: instrument.sources,
    nodes: instrument.nodes,
    duration,
    graph: 'Shared metronome instrument → audio-clock scheduler → Destination',
    data: { instrument },
  }
}
