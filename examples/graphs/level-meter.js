// Level meter: Show live microphone RMS and peak level in dBFS, uncalibrated, with fast or slow meter ballistics.
// CLI: node examples/level-meter.js
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

export function init(ctx, {
  stream, gain = 1, destination = ctx.destination,
} = {}) {
  if (!stream) throw new TypeError('A MediaStream is required')
  let source = ctx.createMediaStreamSource(stream)
  let input = ctx.createGain()
  let analyser = ctx.createAnalyser()
  let mute = ctx.createGain()
  input.gain.value = gain
  analyser.fftSize = 2048
  mute.gain.value = 0
  source.connect(input).connect(analyser).connect(mute).connect(destination)
  return {
    sources: [],
    nodes: [source, input, analyser, mute],
    duration: Infinity,
    graph: 'Microphone → Gain → Analyser → level ballistics',
  }
}
