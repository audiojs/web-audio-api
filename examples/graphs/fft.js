// FFT spectrum: Render a two-tone signal and inspect its frequency-domain peaks.
// CLI: node examples/fft.js
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function safeStop(source, time) {
  try { source.stop(time) } catch { return }
}

export function init(ctx, {
  f1 = 440, f2 = 880, fftSize = 2048, duration = 1.5, gain = 0.5, when = ctx.currentTime,
  destination = ctx.destination, analyser = null,
} = {}) {
  let frequencies = [Number(f1), Number(f2)]
  let meter = analyser || ctx.createAnalyser(), mix = ctx.createGain(); mix.gain.value = gain
  meter.fftSize = Number(fftSize); mix.connect(meter).connect(destination)
  let sources = [], nodes = [mix, meter]
  for (let frequency of frequencies) {
    let osc = ctx.createOscillator(); osc.frequency.value = frequency; osc.connect(mix); osc.start(when); safeStop(osc, when + duration + 0.01)
    sources.push(osc); nodes.push(osc)
  }
  return { sources, nodes, duration, graph: '2 Oscillators → Analyser → Destination', data: { analyser: meter } }
}
