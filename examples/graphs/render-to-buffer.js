// Offline render: Render a complete graph to an AudioBuffer with no speakers or audio device.
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
  frequency = 440, waveform = 'sine', duration = 2, gain = 1,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let osc = ctx.createOscillator()
  let master = ctx.createGain()
  osc.type = waveform
  osc.frequency.value = frequency
  master.gain.value = gain
  osc.connect(master).connect(destination)
  osc.start(when)
  fadeOut(master.gain, when, duration, gain)
  safeStop(osc, when + duration + 0.01)
  return result({ sources: [osc], nodes: [osc, master], duration, graph: 'Oscillator → Gain → Destination' })
}
