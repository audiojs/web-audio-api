// Binaural beats: Send nearby frequencies to opposite ears and hear their difference.
// CLI: node examples/binaural-beats.js 200 10 10s
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

export function build(ctx, {
  frequency = 200, difference = 8, duration = 4, gain = 0.14,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let left = ctx.createOscillator(), right = ctx.createOscillator()
  let panLeft = ctx.createStereoPanner(), panRight = ctx.createStereoPanner()
  let master = ctx.createGain()
  left.frequency.value = frequency; right.frequency.value = frequency + difference
  panLeft.pan.value = -1; panRight.pan.value = 1; master.gain.value = gain
  left.connect(panLeft).connect(master); right.connect(panRight).connect(master); master.connect(destination)
  left.start(when); right.start(when)
  fadeOut(master.gain, when, duration, gain)
  safeStop(left, when + duration + 0.01); safeStop(right, when + duration + 0.01)
  return { sources: [left, right], nodes: [left, right, panLeft, panRight, master], duration, graph: '2 Oscillators → hard L/R pan → Destination' }
}
