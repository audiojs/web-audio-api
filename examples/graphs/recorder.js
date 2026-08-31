// Microphone recorder: Capture microphone audio with a live level meter and save a recording.
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function result({ sources = [], nodes = [], duration = 3, graph, data } = {}) {
  return { sources, nodes, duration, graph, data }
}

export function build(ctx, {
  stream, gain = 1, recorder = null, destination = ctx.destination,
} = {}) {
  if (!stream) throw new TypeError('A MediaStream is required')
  let source = ctx.createMediaStreamSource(stream)
  let input = ctx.createGain()
  let analyser = ctx.createAnalyser()
  let mute = ctx.createGain()
  input.gain.value = gain
  analyser.fftSize = 4096
  mute.gain.value = 0
  source.connect(input).connect(analyser).connect(mute).connect(destination)
  let nodes = [source, input, analyser, mute]
  if (recorder) {
    analyser.connect(recorder).connect(destination)
    nodes.push(recorder)
  }
  return result({ nodes, duration: Infinity, graph: 'Microphone → Gain → recorder boundary' })
}
