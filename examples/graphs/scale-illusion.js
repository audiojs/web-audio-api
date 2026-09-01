// Scale illusion: Interleave an ascending and descending major scale between ears so listeners regroup by pitch.
// CLI: node examples/scale-illusion.js 200 261.63 8s
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
  tempo = 200, root = 261.63, duration = 8, gain = 0.15,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let deg = [0, 2, 4, 5, 7, 9, 11, 12]
  let step = 60 / tempo
  let left = ctx.createOscillator(), right = ctx.createOscillator()
  let panLeft = ctx.createStereoPanner(), panRight = ctx.createStereoPanner()
  let master = ctx.createGain()
  panLeft.pan.value = -1; panRight.pan.value = 1; master.gain.value = gain
  left.connect(panLeft).connect(master); right.connect(panRight).connect(master); master.connect(destination)
  // Two persistent oscillators, retuned every note: the same ascending and
  // descending scale degrees just swap ears each step.
  for (let i = 0; i * step < duration; i++) {
    let n = i % deg.length
    let ascending = root * 2 ** (deg[n] / 12)
    let descending = root * 2 ** (deg[deg.length - 1 - n] / 12)
    let time = when + i * step
    let leftGetsAscending = i % 2 === 0
    left.frequency.setValueAtTime(leftGetsAscending ? ascending : descending, time)
    right.frequency.setValueAtTime(leftGetsAscending ? descending : ascending, time)
  }
  left.start(when); right.start(when)
  fadeOut(master.gain, when, duration, gain)
  safeStop(left, when + duration + 0.02); safeStop(right, when + duration + 0.02)
  return { sources: [left, right], nodes: [left, right, panLeft, panRight, master], duration, graph: 'Ascending + descending scale (stepped frequency) → hard L/R pan → Destination' }
}
