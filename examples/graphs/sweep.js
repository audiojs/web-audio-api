// Frequency sweep: Sweep across a frequency range with linear or exponential automation.
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
  from = 80, to = 8000, mode = 'exponential', duration = 3, gain = 0.2,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  from = Math.max(1, from)
  to = Math.max(1, to)
  let osc = ctx.createOscillator()
  let master = ctx.createGain()
  osc.frequency.setValueAtTime(from, when)
  if (mode === 'linear') osc.frequency.linearRampToValueAtTime(to, when + duration)
  else osc.frequency.exponentialRampToValueAtTime(to, when + duration)
  master.gain.setValueAtTime(0, when)
  master.gain.linearRampToValueAtTime(gain, when + Math.min(0.08, duration / 8))
  fadeOut(master.gain, when, duration, gain)
  osc.connect(master).connect(destination)
  osc.start(when)
  safeStop(osc, when + duration + 0.01)
  return result({ sources: [osc], nodes: [osc, master], duration, graph: 'Oscillator.frequency automation → Gain → Destination' })
}
