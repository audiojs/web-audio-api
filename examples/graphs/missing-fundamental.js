// Missing fundamental: Play harmonics 2–6 while omitting the pitch the listener still perceives.
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function result({ sources = [], nodes = [], duration = 3, graph, data } = {}) {
  return { sources, nodes, duration, graph, data }
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
  frequency = 100, duration = 3, gain = 0.12, when = ctx.currentTime,
  destination = ctx.destination,
} = {}) {
  let master = ctx.createGain(); master.gain.value = gain; master.connect(destination)
  let sources = [], nodes = [master]
  for (let harmonic = 2; harmonic <= 6; harmonic++) {
    let osc = ctx.createOscillator(), level = ctx.createGain()
    osc.frequency.value = frequency * harmonic
    level.gain.value = 1 / harmonic
    osc.connect(level).connect(master)
    osc.start(when); safeStop(osc, when + duration + 0.01)
    sources.push(osc); nodes.push(osc, level)
  }
  fadeOut(master.gain, when, duration, gain)
  return result({ sources, nodes, duration, graph: 'Harmonics 2–6 → weighted mix → Destination' })
}
