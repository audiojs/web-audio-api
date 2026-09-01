// LFO tremolo: Connect an oscillator to an AudioParam and modulate gain at audio-clock precision.
// CLI: node examples/lfo.js rate=5 depth=0.5 -d 10s
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
  carrier = 440, rate = 5, depth = 0.55, waveform = 'sine', duration = 4, gain = 0.2,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let voice = ctx.createOscillator(), lfo = ctx.createOscillator(), lfoGain = ctx.createGain()
  let offset = ctx.createConstantSource(), mixer = ctx.createGain(), master = ctx.createGain()
  voice.frequency.value = carrier; lfo.type = waveform; lfo.frequency.value = rate
  lfoGain.gain.value = depth; offset.offset.value = 1 - depth; mixer.gain.value = 0; master.gain.value = gain
  voice.connect(mixer).connect(master).connect(destination); lfo.connect(lfoGain).connect(mixer.gain); offset.connect(mixer.gain)
  voice.start(when); lfo.start(when); offset.start(when); fadeOut(master.gain, when, duration, gain)
  for (let source of [voice, lfo, offset]) safeStop(source, when + duration + 0.01)
  return { sources: [voice, lfo, offset], nodes: [voice, lfo, lfoGain, offset, mixer, master], duration, graph: 'LFO + ConstantSource → Gain.gain ← Carrier' }
}
