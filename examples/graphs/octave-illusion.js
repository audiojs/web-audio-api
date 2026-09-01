// Octave illusion: Swap two antiphase frequencies between ears so a single tone seems to jump register and side.
// CLI: npx web-audio-api octave-illusion 400 800 2 12s
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
  low = 400, high = 800, rate = 2, duration = 12, gain = 0.16,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let step = 1 / rate
  let left = ctx.createOscillator(), right = ctx.createOscillator()
  let panLeft = ctx.createStereoPanner(), panRight = ctx.createStereoPanner()
  let master = ctx.createGain()
  panLeft.pan.value = -1; panRight.pan.value = 1; master.gain.value = gain
  left.connect(panLeft).connect(master); right.connect(panRight).connect(master); master.connect(destination)
  // Two persistent oscillators, retuned every beat: avoids spawning a fresh
  // node pair per beat, so ears alternate register without any new node ever
  // starting adjacent to another at a different pitch.
  for (let i = 0; i * step < duration; i++) {
    let time = when + i * step, leftHigh = i % 2 === 0
    left.frequency.setValueAtTime(leftHigh ? high : low, time)
    right.frequency.setValueAtTime(leftHigh ? low : high, time)
  }
  left.start(when); right.start(when)
  fadeOut(master.gain, when, duration, gain)
  safeStop(left, when + duration + 0.02); safeStop(right, when + duration + 0.02)
  return { sources: [left, right], nodes: [left, right, panLeft, panRight, master], duration, graph: '2 Oscillators (stepped frequency) → hard L/R pan → Destination' }
}
