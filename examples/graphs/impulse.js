// Dirac impulse: Fire a one-sample impulse for response and signal-path testing.
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function result({ sources = [], nodes = [], duration = 3, graph, data } = {}) {
  return { sources, nodes, duration, graph, data }
}

export function build(ctx, {
  count = 3, interval = 0.45, gain = 0.35, when = ctx.currentTime,
  destination = ctx.destination,
} = {}) {
  let buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
  buffer.getChannelData(0)[0] = gain
  let sources = []
  for (let i = 0; i < count; i++) {
    let source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(destination)
    source.start(when + i * interval)
    sources.push(source)
  }
  return result({ sources, nodes: [...sources], duration: Math.max(0.5, (count - 1) * interval + 0.4), graph: 'One-sample AudioBuffer → Destination' })
}
