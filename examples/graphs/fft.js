// FFT spectrum: Render a two-tone signal and inspect its frequency-domain peaks.
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function result({ sources = [], nodes = [], duration = 3, graph, data } = {}) {
  return { sources, nodes, duration, graph, data }
}

function safeStop(source, time) {
  try { source.stop(time) } catch { return }
}

export function build(ctx, {
  frequencies = [440, 880], duration = 1.5, gain = 0.5, when = ctx.currentTime,
  destination = ctx.destination, analyser = null,
} = {}) {
  let meter = analyser || ctx.createAnalyser(), mix = ctx.createGain(); mix.gain.value = gain
  meter.fftSize = 2048; mix.connect(meter).connect(destination)
  let sources = [], nodes = [mix, meter]
  for (let frequency of frequencies) {
    let osc = ctx.createOscillator(); osc.frequency.value = frequency; osc.connect(mix); osc.start(when); safeStop(osc, when + duration + 0.01)
    sources.push(osc); nodes.push(osc)
  }
  return result({ sources, nodes, duration, graph: '2 Oscillators → Analyser → Destination', data: { analyser: meter } })
}
