// Latency tester: Play short clicks through the speakers and time their return through the microphone to measure round-trip latency.
// CLI: node examples/latency-tester.js
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function seeded(seed = 0x4c415445) {
  let state = seed >>> 0
  return () => {
    state += 0x6D2B79F5
    let n = state
    n = Math.imul(n ^ n >>> 15, n | 1)
    n ^= n + Math.imul(n ^ n >>> 7, n | 61)
    return ((n ^ n >>> 14) >>> 0) / 4294967296
  }
}

export function init(ctx, {
  stream, destination = ctx.destination,
} = {}) {
  if (!stream) throw new TypeError('A MediaStream is required')
  let random = seeded()
  let source = ctx.createMediaStreamSource(stream)
  let input = ctx.createGain()
  let analyser = ctx.createAnalyser()
  let mute = ctx.createGain()
  input.gain.value = 1
  analyser.fftSize = 2048
  mute.gain.value = 0
  source.connect(input).connect(analyser).connect(mute).connect(destination)

  let noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.02), ctx.sampleRate)
  let noise = noiseBuffer.getChannelData(0)
  for (let i = 0; i < noise.length; i++) noise[i] = random() * 2 - 1

  // A short, sharp click: filtered noise burst with a fast attack so its onset is easy to
  // pick out of the microphone signal.
  let click = when => {
    let burst = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), envelope = ctx.createGain()
    burst.buffer = noiseBuffer
    filter.type = 'bandpass'; filter.frequency.value = 2800; filter.Q.value = 0.9
    envelope.gain.setValueAtTime(0.9, when)
    envelope.gain.exponentialRampToValueAtTime(0.001, when + 0.02)
    burst.connect(filter).connect(envelope).connect(destination)
    burst.start(when); burst.stop(when + 0.03)
    burst.onended = () => { filter.disconnect(); envelope.disconnect() }
  }

  return {
    sources: [],
    nodes: [source, input, analyser, mute],
    duration: Infinity,
    graph: 'Click generator → Destination; Microphone → Analyser',
    data: { click },
  }
}
