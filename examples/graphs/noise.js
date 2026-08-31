// Colored noise: Generate white, pink, brown, blue, or violet noise.
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function seeded(seed = 0x574141) {
  let state = seed >>> 0
  return () => {
    state += 0x6D2B79F5
    let n = state
    n = Math.imul(n ^ n >>> 15, n | 1)
    n ^= n + Math.imul(n ^ n >>> 7, n | 61)
    return ((n ^ n >>> 14) >>> 0) / 4294967296
  }
}

function result({ sources = [], nodes = [], duration = 3, graph, data } = {}) {
  return { sources, nodes, duration, graph, data }
}

function fadeOut(param, when, duration, value) {
  let end = when + duration
  let start = Math.max(when, end - Math.min(0.08, duration / 4))
  param.setValueAtTime(value, start)
  param.linearRampToValueAtTime(0, end)
}

function safeStop(source, time) {
  try { source.stop(time) } catch { return }
}

export function build(ctx, {
  color = 'pink', duration = 3, gain = 0.18, seed = 0x4e4f4953,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let random = seeded(seed)
  let length = Math.ceil(ctx.sampleRate * duration)
  let buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  let out = buffer.getChannelData(0)
  let b = new Float64Array(7), brown = 0, prev0 = 0, prev1 = 0
  for (let i = 0; i < out.length; i++) {
    let w = random() * 2 - 1
    if (color === 'white') out[i] = w
    else if (color === 'brown') {
      brown = (brown + 0.02 * w) / 1.02
      out[i] = brown * 3.5
    } else if (color === 'blue') {
      out[i] = (w - prev0) * 0.5
      prev0 = w
    } else if (color === 'violet') {
      out[i] = (w - 2 * prev0 + prev1) * 0.25
      prev1 = prev0; prev0 = w
    } else {
      b[0] = 0.99886 * b[0] + w * 0.0555179
      b[1] = 0.99332 * b[1] + w * 0.0750759
      b[2] = 0.969 * b[2] + w * 0.153852
      b[3] = 0.8665 * b[3] + w * 0.3104856
      b[4] = 0.55 * b[4] + w * 0.5329522
      b[5] = -0.7616 * b[5] - w * 0.016898
      out[i] = (b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b[6] + w * 0.5362) * 0.11
      b[6] = w * 0.115926
    }
  }
  let source = ctx.createBufferSource()
  let master = ctx.createGain()
  source.buffer = buffer
  master.gain.value = gain
  source.connect(master).connect(destination)
  source.start(when)
  fadeOut(master.gain, when, duration, gain)
  safeStop(source, when + duration + 0.01)
  return result({ sources: [source], nodes: [source, master], duration, graph: 'Generated noise buffer → Gain → Destination' })
}
