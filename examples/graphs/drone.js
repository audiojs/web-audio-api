// Harmonic drone: Layer lightly detuned harmonics into a tanpura-like four-string drone.
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function seeded(seed = 0x574141) {
  let state = seed >>> 0
  return () => {
    state += 0x6D2B79F5
    let n = state
    n = Math.imul(n ^ n >>> 15, n | 1)
    n ^= n + Math.imul(n ^ n >>> 7, n | 61)
    return ((n ^ n >>> 14) >>> 0) / 4294967296
  }
}

function fadeOut(param, when, duration, value) {
  let end = when + duration
  let start = Math.max(when, end - Math.min(0.08, duration / 4))
  param.setValueAtTime(value, start)
  param.linearRampToValueAtTime(0, end)
}

function safeStop(source, time) {
  try { source.stop(time) } catch { return }
}

export function build(ctx, {
  frequency = 130.81, duration = 5, seed = 0x44524f4e, when = ctx.currentTime,
  destination = ctx.destination,
} = {}) {
  let random = seeded(seed), master = ctx.createGain(); master.gain.value = 0.08; master.connect(destination)
  let sources = [], nodes = [master], voices = []
  for (let ratio of [1.5, 1, 1.001, 0.5]) for (let harmonic = 1; harmonic <= 10; harmonic++) {
    let osc = ctx.createOscillator(), level = ctx.createGain()
    osc.frequency.value = frequency * ratio * harmonic * (1 + (random() - 0.5) * 0.0005)
    level.gain.value = harmonic <= 3 ? 1 / harmonic : 0.7 / harmonic
    osc.connect(level).connect(master); osc.start(when); safeStop(osc, when + duration + 0.01)
    sources.push(osc); nodes.push(osc, level); voices.push({ osc, harmonic, ratio })
  }
  master.gain.setValueAtTime(0, when); master.gain.linearRampToValueAtTime(0.08, when + Math.min(2, duration / 3))
  fadeOut(master.gain, when, duration, 0.08)
  let retune = (nextFrequency, time = ctx.currentTime) => {
    for (let voice of voices) voice.osc.frequency.setTargetAtTime(nextFrequency * voice.ratio * voice.harmonic * (1 + (random() - 0.5) * 0.0005), time, 0.08)
  }
  return { sources, nodes, duration, graph: 'Detuned harmonic banks → Master Gain → Destination', data: { master, retune } }
}
