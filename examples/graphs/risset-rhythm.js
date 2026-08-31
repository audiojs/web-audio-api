// Risset rhythm: Layer tempo cycles to create a beat that appears to accelerate or decelerate forever.
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function result({ sources = [], nodes = [], duration = 3, graph, data } = {}) {
  return { sources, nodes, duration, graph, data }
}

function safeStop(source, time) {
  try { source.stop(time) } catch { return }
}

export function build(ctx, {
  direction = 'up', bpm = 110, duration = 5, when = ctx.currentTime,
  destination = ctx.destination,
} = {}) {
  let sign = direction === 'down' ? -1 : 1
  let sources = [], nodes = [], voices = 5, period = 7
  for (let voice = 0; voice < voices; voice++) {
    let offset = voice / voices
    for (let t = 0; t < duration;) {
      let phase = ((t / period * sign + offset) % 1 + 1) % 1
      let tempo = bpm * 2 ** phase
      let amp = Math.exp(-0.5 * ((phase - 0.5) / 0.34) ** 2)
      if (amp > 0.04) {
        let time = when + t
        let osc = ctx.createOscillator(), env = ctx.createGain()
        osc.frequency.setValueAtTime(1000, time)
        osc.frequency.exponentialRampToValueAtTime(360, time + 0.025)
        env.gain.setValueAtTime(amp * 0.13, time)
        env.gain.exponentialRampToValueAtTime(0.001, time + 0.055)
        osc.connect(env).connect(destination)
        osc.start(time); safeStop(osc, time + 0.07)
        sources.push(osc); nodes.push(osc, env)
      }
      t += 60 / tempo
    }
  }
  return result({ sources, nodes, duration, graph: 'Layered tempo cycles → click envelopes → Destination' })
}
