// Mic level: Route a live microphone through a gain and analyser with an RMS meter.
// CLI: node examples/mic.js gain=0.8
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

export function init(ctx, {
  stream, gain = 1, monitor = false, destination = ctx.destination,
} = {}) {
  if (!stream) throw new TypeError('A MediaStream is required')
  let source = ctx.createMediaStreamSource(stream)
  let input = ctx.createGain()
  let analyser = ctx.createAnalyser()
  input.gain.value = gain
  analyser.fftSize = 4096
  source.connect(input).connect(analyser)
  let nodes = [source, input, analyser]
  if (monitor) analyser.connect(destination)
  else {
    let mute = ctx.createGain()
    mute.gain.value = 0
    analyser.connect(mute).connect(destination)
    nodes.push(mute)
  }
  return { sources: [], nodes, duration: Infinity, graph: 'Microphone → Gain → Analyser' }
}
