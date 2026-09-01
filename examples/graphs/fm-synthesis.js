// FM synth: Use one oscillator to modulate another oscillator’s frequency.
// CLI: npx web-audio-api fm-synthesis 440 2 5 3s
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
  carrier = 220, ratio = 2, index = 4, duration = 3, when = ctx.currentTime,
  destination = ctx.destination,
} = {}) {
  let mod = ctx.createOscillator(), modGain = ctx.createGain(), car = ctx.createOscillator(), master = ctx.createGain()
  mod.frequency.value = carrier * ratio; modGain.gain.value = index * carrier * ratio
  car.frequency.value = carrier; master.gain.value = 0.2
  mod.connect(modGain).connect(car.frequency); car.connect(master).connect(destination)
  mod.start(when); car.start(when); fadeOut(master.gain, when, duration, 0.2)
  safeStop(mod, when + duration + 0.01); safeStop(car, when + duration + 0.01)
  return { sources: [mod, car], nodes: [mod, modGain, car, master], duration, graph: 'Modulator → Carrier.frequency → Gain → Destination' }
}
