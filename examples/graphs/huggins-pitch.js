// Huggins pitch: Filter one ear's copy of identical noise through a narrow phase shift so a pitch emerges that exists in neither channel.
// CLI: npx web-audio-api huggins-pitch 600 20s
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function seeded(seed = 0x4855474e) {
  let state = seed >>> 0
  return () => {
    state += 0x6D2B79F5
    let n = state
    n = Math.imul(n ^ n >>> 15, n | 1)
    n ^= n + Math.imul(n ^ n >>> 7, n | 61)
    return ((n ^ n >>> 14) >>> 0) / 4294967296
  }
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

export function init(ctx, {
  frequency = 600, duration = 20, gain = 0.22, seed = 0x4855474e, stages = 6,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let random = seeded(seed)
  let length = Math.ceil(ctx.sampleRate * duration)
  let buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  let data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = random() * 2 - 1

  let dry = ctx.createBufferSource(), shifted = ctx.createBufferSource()
  dry.buffer = buffer; shifted.buffer = buffer

  let merger = ctx.createChannelMerger(2), master = ctx.createGain()
  master.gain.value = gain
  merger.connect(master).connect(destination)
  dry.connect(merger, 0, 0)

  let node = shifted, filters = []
  for (let i = 0; i < stages; i++) {
    let allpass = ctx.createBiquadFilter()
    allpass.type = 'allpass'; allpass.frequency.value = frequency; allpass.Q.value = 3
    node.connect(allpass); node = allpass; filters.push(allpass)
  }
  node.connect(merger, 0, 1)

  dry.start(when); shifted.start(when)
  fadeOut(master.gain, when, duration, gain)
  safeStop(dry, when + duration + 0.01); safeStop(shifted, when + duration + 0.01)

  return { sources: [dry, shifted], nodes: [...filters, merger, master], duration, graph: 'Noise → dry + cascaded Allpass → ChannelMerger → Destination' }
}
