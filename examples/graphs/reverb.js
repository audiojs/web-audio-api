// Convolver reverb: Convolve a plucked string through a seeded exponential-decay impulse response and blend dry with wet.
// CLI: npx web-audio-api reverb 2 0.35 3s
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function seeded(seed = 0x52455642) {
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

export function init(ctx, {
  decay = 2, wet = 0.35, frequency = 220, duration = 3, gain = 0.5, seed = 0x52455642,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let random = seeded(seed)

  // Plucked string: Karplus-Strong noise ring averaged into a static buffer
  let ringLength = Math.max(2, Math.round(ctx.sampleRate / frequency))
  let ring = new Float32Array(ringLength)
  for (let i = 0; i < ringLength; i++) ring[i] = random() * 2 - 1
  let pluckLength = Math.ceil(ctx.sampleRate * 1.2)
  let pluckBuffer = ctx.createBuffer(1, pluckLength, ctx.sampleRate)
  let pluckData = pluckBuffer.getChannelData(0)
  for (let i = 0, p = 0; i < pluckLength; i++) {
    let next = (p + 1) % ringLength
    ring[p] = (ring[p] + ring[next]) * 0.498
    pluckData[i] = ring[p]
    p = next
  }

  // Impulse response: seeded exponential-decay noise
  let irLength = Math.ceil(ctx.sampleRate * decay)
  let irBuffer = ctx.createBuffer(1, irLength, ctx.sampleRate)
  let irData = irBuffer.getChannelData(0)
  for (let i = 0; i < irLength; i++) {
    let t = i / ctx.sampleRate
    irData[i] = (random() * 2 - 1) * Math.exp(-3 * t / decay)
  }

  let source = ctx.createBufferSource(), dry = ctx.createGain(), convolver = ctx.createConvolver(), wetGain = ctx.createGain(), master = ctx.createGain()
  source.buffer = pluckBuffer
  convolver.buffer = irBuffer
  dry.gain.value = 1 - wet; wetGain.gain.value = wet
  master.gain.value = gain
  source.connect(dry).connect(master)
  source.connect(convolver).connect(wetGain).connect(master)
  master.connect(destination)
  source.start(when)
  safeStop(source, when + duration + 0.01)

  return { sources: [source], nodes: [source, dry, convolver, wetGain, master], duration, graph: 'Plucked buffer → dry Gain + Convolver → wet Gain → Destination' }
}
