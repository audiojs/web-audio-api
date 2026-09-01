// Risset rhythm: Layer tempo cycles to create a beat that appears to accelerate or decelerate forever.
// CLI: node examples/risset-rhythm.js up 120 20s
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function safeStop(source, time) {
  try { source.stop(time) } catch { return }
}

export function init(ctx, {
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
      // Raised-cosine (Hann) window: zero at phase 0 and 1, so each layer fades out exactly as
      // it would wrap an octave up and fades in exactly as it reappears an octave down. Windows
      // staggered by 1/voices satisfy the constant-overlap-add identity (the cosines cancel), so
      // the summed loudness across all voices stays constant through the wrap: no seam, no pump.
      let amp = 0.5 * (1 - Math.cos(2 * Math.PI * phase))
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
  return { sources, nodes, duration, graph: 'Layered tempo cycles → click envelopes → Destination' }
}
