// Auditory streaming: Alternate two tones and let tempo and pitch distance decide fusion or split.
// CLI: npx web-audio-api streaming 240 4 15s
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function safeStop(source, time) {
  try { source.stop(time) } catch { return }
}

export function init(ctx, {
  tempo = 240, interval = 4, duration = 15, gain = 0.16, base = 500,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let step = 60 / tempo
  let low = base, high = base * 2 ** (interval / 12)
  let noteDur = step * 0.85
  let attack = Math.min(0.006, noteDur / 6), release = Math.min(0.02, noteDur / 4)
  let osc = ctx.createOscillator(), env = ctx.createGain()
  osc.connect(env).connect(destination)
  env.gain.setValueAtTime(0, when)
  // A single persistent oscillator, retuned and re-enveloped every note:
  // no new node ever starts adjacent to another at a different pitch.
  for (let i = 0; i * step < duration; i++) {
    let time = when + i * step
    osc.frequency.setValueAtTime(i % 2 === 0 ? high : low, time)
    env.gain.setValueAtTime(0, time)
    env.gain.linearRampToValueAtTime(gain, time + attack)
    env.gain.setValueAtTime(gain, time + noteDur - release)
    env.gain.linearRampToValueAtTime(0, time + noteDur)
  }
  osc.start(when); safeStop(osc, when + duration + 0.02)
  return { sources: [osc], nodes: [osc, env], duration, graph: 'Oscillator (stepped frequency) → envelope → Destination' }
}
