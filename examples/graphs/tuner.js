// Microphone tuner: Estimate microphone pitch, nearest note, and tuning error in cents.
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function result({ sources = [], nodes = [], duration = 3, graph, data } = {}) {
  return { sources, nodes, duration, graph, data }
}

export function build(ctx, {
  stream, gain = 1, destination = ctx.destination,
} = {}) {
  if (!stream) throw new TypeError('A MediaStream is required')
  let source = ctx.createMediaStreamSource(stream)
  let input = ctx.createGain()
  let analyser = ctx.createAnalyser()
  let mute = ctx.createGain()
  input.gain.value = gain
  analyser.fftSize = 8192
  mute.gain.value = 0
  source.connect(input).connect(analyser).connect(mute).connect(destination)
  return result({
    nodes: [source, input, analyser, mute],
    duration: Infinity,
    graph: 'Microphone → Analyser → muted destination',
  })
}
