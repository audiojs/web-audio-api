// Subtractive synth: Shape a sawtooth oscillator with a resonant low-pass sweep and ADSR envelope.
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function safeStop(source, time) {
  try { source.stop(time) } catch { return }
}

export function build(ctx, {
  frequency = 220, duration = 2.5, when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let osc = ctx.createOscillator(), filter = ctx.createBiquadFilter(), env = ctx.createGain()
  osc.type = 'sawtooth'; osc.frequency.value = frequency
  filter.type = 'lowpass'; filter.Q.value = 8
  filter.frequency.setValueAtTime(180, when)
  filter.frequency.linearRampToValueAtTime(3600, when + Math.min(0.35, duration / 4))
  filter.frequency.exponentialRampToValueAtTime(220, when + duration * 0.8)
  env.gain.setValueAtTime(0, when)
  env.gain.linearRampToValueAtTime(0.25, when + 0.015)
  env.gain.linearRampToValueAtTime(0.16, when + 0.14)
  env.gain.setValueAtTime(0.16, when + duration * 0.75)
  env.gain.linearRampToValueAtTime(0, when + duration)
  osc.connect(filter).connect(env).connect(destination)
  osc.start(when); safeStop(osc, when + duration + 0.01)
  return { sources: [osc], nodes: [osc, filter, env], duration, graph: 'Sawtooth → BiquadFilter → ADSR Gain → Destination' }
}
