// Beating: Hear amplitude beating produced by two nearby frequencies.
// CLI: node examples/beating.js 440 3 5s
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
  frequency = 440, difference = 3, duration = 4, gain = 0.14,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let a = ctx.createOscillator(), b = ctx.createOscillator(), master = ctx.createGain()
  a.frequency.value = frequency; b.frequency.value = frequency + difference; master.gain.value = gain
  a.connect(master); b.connect(master); master.connect(destination)
  a.start(when); b.start(when); fadeOut(master.gain, when, duration, gain)
  safeStop(a, when + duration + 0.01); safeStop(b, when + duration + 0.01)
  return { sources: [a, b], nodes: [a, b, master], duration, graph: '2 nearby Oscillators → Gain → Destination' }
}
