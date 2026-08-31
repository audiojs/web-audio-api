// Stereo channel test: Identify left, right, and center channels with a panned reference tone.
// CLI: node examples/stereo-test.js 1k 1s
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function safeStop(source, time) {
  try { source.stop(time) } catch { return }
}

export function build(ctx, {
  frequency = 700, durationPerChannel = 0.55, gap = 0.12, gain = 0.22,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let sources = [], nodes = [], time = when
  for (let pan of [-1, 1, 0]) {
    let osc = ctx.createOscillator()
    let panner = ctx.createStereoPanner()
    let env = ctx.createGain()
    osc.frequency.value = frequency
    panner.pan.value = pan
    env.gain.setValueAtTime(0, time)
    env.gain.linearRampToValueAtTime(gain, time + 0.015)
    env.gain.setValueAtTime(gain, time + durationPerChannel - 0.04)
    env.gain.linearRampToValueAtTime(0, time + durationPerChannel)
    osc.connect(panner).connect(env).connect(destination)
    osc.start(time); safeStop(osc, time + durationPerChannel + 0.01)
    sources.push(osc); nodes.push(osc, panner, env)
    time += durationPerChannel + gap
  }
  return { sources, nodes, duration: time - when, graph: 'Oscillator → StereoPanner → Envelope → Destination' }
}
