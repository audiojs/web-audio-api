// Sound recorder: Capture microphone audio with a live level meter and save a recording.
// CLI: node examples/recorder.js take1 gain=2
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

export function init(ctx, {
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
  return { sources: [], nodes, duration: Infinity, graph: 'Microphone → Gain → recorder boundary' }
}
