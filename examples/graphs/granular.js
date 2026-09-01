// Granular synth: Scatter short, jittered grains from a seeded source buffer into a granular cloud.
// CLI: npx web-audio-api granular 0.08 15 4 10s
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function seeded(seed = 0x4752414e) {
  let state = seed >>> 0
  return () => {
    state += 0x6D2B79F5
    let n = state
    n = Math.imul(n ^ n >>> 15, n | 1)
    n ^= n + Math.imul(n ^ n >>> 7, n | 61)
    return ((n ^ n >>> 14) >>> 0) / 4294967296
  }
}

function safeStop(source, time) {
  try { source.stop(time) } catch { return }
}

function buildSourceBuffer(ctx) {
  let dur = 0.35, n = Math.ceil(ctx.sampleRate * dur)
  let buffer = ctx.createBuffer(1, n, ctx.sampleRate)
  let data = buffer.getChannelData(0)
  let f0 = 300, f1 = 160, phase = 0
  for (let i = 0; i < n; i++) {
    let t = i / ctx.sampleRate, p = t / dur
    let freq = f0 * (f1 / f0) ** p
    phase += freq / ctx.sampleRate
    let env = Math.sin(Math.PI * p)
    data[i] = (Math.sin(2 * Math.PI * phase) + 0.35 * Math.sin(4 * Math.PI * phase) + 0.15 * Math.sin(6 * Math.PI * phase)) * env * 0.45
  }
  return buffer
}

export function init(ctx, {
  size = 0.08, density = 15, spread = 4, duration = 10, gain = 0.35, seed = 0x4752414e,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let random = seeded(seed)
  let sourceBuffer = buildSourceBuffer(ctx)
  let master = ctx.createGain()
  master.gain.value = gain
  master.connect(destination)
  let sources = [], nodes = [master]
  let interval = 1 / density
  let elapsed = 0

  let scheduleUntil = horizon => {
    while (elapsed < duration && elapsed < horizon) {
      let time = when + elapsed
      let rate = 2 ** (((random() * 2 - 1) * spread) / 12)
      let maxOffset = Math.max(0, sourceBuffer.duration - size * rate)
      let grain = ctx.createBufferSource(), env = ctx.createGain()
      grain.buffer = sourceBuffer; grain.playbackRate.value = rate
      let attack = size * 0.4
      env.gain.setValueAtTime(0, time)
      env.gain.linearRampToValueAtTime(1, time + attack)
      env.gain.linearRampToValueAtTime(0, time + size)
      grain.connect(env).connect(master)
      grain.start(time, random() * maxOffset)
      safeStop(grain, time + size + 0.01)
      sources.push(grain); nodes.push(grain, env)
      elapsed += interval * (0.7 + random() * 0.6)
    }
  }
  // Offline contexts render faster than wall clock, so every grain is scheduled
  // upfront; live contexts get a rolling lookahead window, keeping the node
  // count bounded however long the run is
  if (typeof ctx.startRendering === 'function') scheduleUntil(duration)
  else {
    let lookahead = 4
    scheduleUntil(ctx.currentTime - when + lookahead)
    if (elapsed < duration) {
      let timer = setInterval(() => {
        if (ctx.state !== 'running' || elapsed >= duration) return clearInterval(timer)
        scheduleUntil(ctx.currentTime - when + lookahead)
      }, 500)
    }
  }
  return { sources, nodes, duration, graph: 'Source buffer → jittered grains → envelopes → Destination' }
}
