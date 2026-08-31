// Process an audio file: Decode an audio file, apply EQ and compression, then render the processed result.
// CLI: node examples/process-file.js input.mp3
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function safeStop(source, time) {
  try { source.stop(time) } catch { return }
}

export function build(ctx, buffer, {
  highShelfFrequency = 4000, highShelfGain = -6, threshold = -20, ratio = 4,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let source = ctx.createBufferSource(), eq = ctx.createBiquadFilter(), compressor = ctx.createDynamicsCompressor()
  source.buffer = buffer; eq.type = 'highshelf'; eq.frequency.value = highShelfFrequency; eq.gain.value = highShelfGain
  compressor.threshold.value = threshold; compressor.ratio.value = ratio
  source.connect(eq).connect(compressor).connect(destination); source.start(when); safeStop(source, when + buffer.duration + 0.01)
  return { sources: [source], nodes: [source, eq, compressor], duration: buffer.duration, graph: 'AudioBuffer → high-shelf EQ → compressor → Destination' }
}
