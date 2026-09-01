// Tritone paradox: Play sequential octave-complex tone pairs a tritone apart so up/down judgment turns ambiguous.
// CLI: node examples/tritone-paradox.js 0 8 1.2
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function safeStop(source, time) {
  try { source.stop(time) } catch { return }
}

export function init(ctx, {
  root = 0, pairs = 8, rate = 1.2, gain = 0.12,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let step = 1 / rate
  let partials = [-3, -2, -1, 0, 1, 2, 3]
  let events = pairs * 2
  let master = ctx.createGain()
  master.gain.setValueAtTime(0, when)
  master.connect(destination)
  // A persistent Gaussian-weighted octave-complex bank, retuned every event:
  // no new oscillator ever starts, only the shared bank's pitch class moves.
  let voices = partials.map(offset => {
    let osc = ctx.createOscillator(), level = ctx.createGain()
    level.gain.value = Math.exp(-0.5 * (offset / 2) ** 2)
    osc.connect(level).connect(master)
    return { osc, level, offset }
  })
  for (let i = 0; i < events; i++) {
    let pc = i % 2 === 0 ? root : (root + 6) % 12
    let base = 440 * 2 ** ((pc - 9) / 12)
    let time = when + i * step
    for (let { osc, offset } of voices) osc.frequency.setValueAtTime(base * 2 ** offset, time)
    master.gain.setValueAtTime(0, time)
    master.gain.linearRampToValueAtTime(gain, time + 0.015)
    master.gain.setValueAtTime(gain, time + step * 0.55)
    master.gain.exponentialRampToValueAtTime(0.001, time + step * 0.85)
  }
  let end = when + events * step
  for (let { osc } of voices) { osc.start(when); safeStop(osc, end + 0.02) }
  return {
    sources: voices.map(v => v.osc),
    nodes: [...voices.flatMap(v => [v.osc, v.level]), master],
    duration: events * step,
    graph: 'Octave-complex bank (retuned per event) → Gaussian gains → Destination',
  }
}
