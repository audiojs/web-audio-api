// Spatial panning: Move a source from left to right through three-dimensional space.
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
  frequency = 440, duration = 3, gain = 0.22, when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let osc = ctx.createOscillator(), panner = ctx.createPanner(), master = ctx.createGain()
  osc.frequency.value = frequency; panner.panningModel = 'equalpower'; panner.distanceModel = 'inverse'
  panner.positionX.setValueAtTime(-7, when); panner.positionX.linearRampToValueAtTime(7, when + duration)
  panner.positionY.value = 0; panner.positionZ.value = -2; master.gain.value = gain
  osc.connect(panner).connect(master).connect(destination); osc.start(when); fadeOut(master.gain, when, duration, gain)
  safeStop(osc, when + duration + 0.01)
  return result({ sources: [osc], nodes: [osc, panner, master], duration, graph: 'Oscillator → Panner → Gain → Destination' })
}
