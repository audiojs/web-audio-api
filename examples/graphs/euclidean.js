// Euclidean rhythms: Drive 2-3 percussion voices from Bjorklund Euclidean rhythms, each with its own step and pulse count.
// CLI: node examples/euclidean.js 120 16 3,5,7 20s
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function seeded(seed = 0x4555434c) {
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

// Bjorklund's bucket-merging algorithm: distributes `pulses` as evenly as
// possible across `steps`, always starting on a pulse.
function bjorklund(pulses, steps) {
  pulses = Math.max(0, Math.min(steps, pulses | 0))
  if (pulses === 0) return new Array(steps).fill(false)
  if (pulses === steps) return new Array(steps).fill(true)
  let a = Array.from({ length: pulses }, () => [true])
  let b = Array.from({ length: steps - pulses }, () => [false])
  while (b.length > 1) {
    let n = Math.min(a.length, b.length)
    let merged = []
    for (let i = 0; i < n; i++) merged.push([...a[i], ...b[i]])
    let remainder = a.length > n ? a.slice(n) : b.slice(n)
    a = merged; b = remainder
  }
  return [...a, ...b].flat()
}

export function init(ctx, {
  tempo = 120, steps = 16, pulses = '3,5,7', duration = 20, seed = 0x4555434c,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let random = seeded(seed)
  let voicePulses = String(pulses).split(',').map(Number).filter(n => Number.isFinite(n) && n >= 0).slice(0, 3)
  if (!voicePulses.length) voicePulses = [3, 5, 7]
  let patterns = voicePulses.map(p => bjorklund(p, steps))
  let voiceSpecs = [
    { type: 'bandpass', frequency: 90, q: 1.1, decay: 0.09, level: 0.34 },
    { type: 'bandpass', frequency: 900, q: 1.4, decay: 0.05, level: 0.2 },
    { type: 'highpass', frequency: 6000, q: 0.7, decay: 0.03, level: 0.14 },
  ]

  let master = ctx.createGain()
  master.gain.value = 0.9
  master.connect(destination)
  let sources = [], nodes = [master]

  let noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate), ctx.sampleRate)
  let noiseData = noiseBuffer.getChannelData(0)
  for (let i = 0; i < noiseData.length; i++) noiseData[i] = random() * 2 - 1

  let hit = (time, spec) => {
    let burst = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), env = ctx.createGain()
    burst.buffer = noiseBuffer
    filter.type = spec.type; filter.frequency.value = spec.frequency; filter.Q.value = spec.q
    let level = spec.level * (0.85 + random() * 0.3)
    env.gain.setValueAtTime(level, time)
    env.gain.exponentialRampToValueAtTime(0.001, time + spec.decay)
    burst.connect(filter).connect(env).connect(master)
    burst.start(time, random() * Math.max(0, noiseBuffer.duration - spec.decay))
    safeStop(burst, time + spec.decay + 0.01)
    sources.push(burst); nodes.push(burst, filter, env)
  }

  let step = 60 / tempo / 4
  let elapsed = 0, stepIndex = 0
  let scheduleUntil = horizon => {
    while (elapsed < duration && elapsed < horizon) {
      let time = when + elapsed
      for (let v = 0; v < patterns.length; v++) if (patterns[v][stepIndex % patterns[v].length]) hit(time, voiceSpecs[v])
      elapsed += step
      stepIndex++
    }
  }
  // Offline contexts render faster than wall clock, so every hit is scheduled
  // upfront; live contexts get a rolling lookahead window, keeping the node
  // count bounded however long the run is
  if (typeof ctx.startRendering === 'function') scheduleUntil(duration)
  else {
    let lookahead = 6
    scheduleUntil(ctx.currentTime - when + lookahead)
    if (elapsed < duration) {
      let timer = setInterval(() => {
        if (ctx.state !== 'running' || elapsed >= duration) return clearInterval(timer)
        scheduleUntil(ctx.currentTime - when + lookahead)
      }, 800)
    }
  }
  return { sources, nodes, duration, graph: 'Euclidean patterns → percussion voices → Destination' }
}
