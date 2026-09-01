// Additive synth: Construct square, saw, and triangle timbres from individual harmonics.
// CLI: node examples/additive.js square 220 16 3s
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function fadeOut(param, when, duration, value) {
  let end = when + duration
  let start = Math.max(when, end - Math.min(0.08, duration / 4))
  param.setValueAtTime(value, start)
  param.linearRampToValueAtTime(0, end)
}

function safeStop(source, time) {
  try { source.stop(time) } catch { return }
}

export function init(ctx, {
  waveform = 'square', frequency = 220, harmonics = 14, duration = 3,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let master = ctx.createGain(); master.gain.value = 0.22; master.connect(destination)
  let sources = [], nodes = [master]
  let amplitude = harmonic => waveform === 'square' ? (harmonic % 2 ? 1 / harmonic : 0)
    : waveform === 'triangle' ? (harmonic % 2 ? (-1) ** ((harmonic - 1) / 2) / (harmonic * harmonic) : 0)
    : 1 / harmonic
  for (let harmonic = 1; harmonic <= harmonics; harmonic++) {
    let value = amplitude(harmonic)
    if (Math.abs(value) < 0.001 || frequency * harmonic >= ctx.sampleRate * 0.45) continue
    let osc = ctx.createOscillator(), level = ctx.createGain()
    osc.frequency.value = frequency * harmonic; level.gain.value = value
    osc.connect(level).connect(master); osc.start(when); safeStop(osc, when + duration + 0.01)
    sources.push(osc); nodes.push(osc, level)
  }
  fadeOut(master.gain, when, duration, 0.22)
  return { sources, nodes, duration, graph: 'Harmonic oscillator bank → weighted mix → Destination' }
}
