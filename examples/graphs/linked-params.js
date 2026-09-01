// Linked AudioParams: Drive multiple gain parameters from one ConstantSourceNode.
// CLI: npx web-audio-api linked-params
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function safeStop(source, time) {
  try { source.stop(time) } catch { return }
}

export function init(ctx, {
  duration = 2, when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let a = ctx.createOscillator(), b = ctx.createOscillator(), gainA = ctx.createGain(), gainB = ctx.createGain()
  let control = ctx.createConstantSource(), mix = ctx.createGain()
  a.frequency.value = 440; b.frequency.value = 660; gainA.gain.value = 0; gainB.gain.value = 0; mix.gain.value = 0.4
  control.offset.setValueAtTime(0, when); control.offset.linearRampToValueAtTime(0.45, when + duration * 0.25)
  control.offset.setValueAtTime(0.45, when + duration * 0.75); control.offset.linearRampToValueAtTime(0, when + duration)
  control.connect(gainA.gain); control.connect(gainB.gain); a.connect(gainA).connect(mix); b.connect(gainB).connect(mix); mix.connect(destination)
  for (let source of [a, b, control]) { source.start(when); safeStop(source, when + duration + 0.01) }
  return { sources: [a, b, control], nodes: [a, b, gainA, gainB, control, mix], duration, graph: 'ConstantSource → 2 Gain AudioParams → mix → Destination' }
}
