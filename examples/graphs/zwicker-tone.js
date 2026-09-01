// Zwicker tone: Notch broadband noise, cycle it on and off, and hear a faint after-tone linger in the silence.
// CLI: npx web-audio-api zwicker-tone 2000 3 2 20s
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function seeded(seed = 0x5a57434b) {
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
  frequency = 2000, on = 3, off = 2, duration = 20, gain = 0.25, seed = 0x5a57434b,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let random = seeded(seed)
  let length = Math.ceil(ctx.sampleRate * Math.min(Math.max(duration, 0.05), 1))
  let buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  let data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = random() * 2 - 1

  let source = ctx.createBufferSource()
  source.buffer = buffer; source.loop = true
  let notch1 = ctx.createBiquadFilter(), notch2 = ctx.createBiquadFilter()
  notch1.type = 'notch'; notch1.frequency.value = frequency; notch1.Q.value = 2
  notch2.type = 'notch'; notch2.frequency.value = frequency; notch2.Q.value = 4
  let master = ctx.createGain()
  source.connect(notch1).connect(notch2).connect(master).connect(destination)

  let fade = 0.02
  master.gain.setValueAtTime(0, when)
  let t = when
  while (t < when + duration) {
    let onEnd = Math.min(t + on, when + duration)
    master.gain.linearRampToValueAtTime(gain, Math.min(t + fade, onEnd))
    master.gain.setValueAtTime(gain, Math.max(t + fade, onEnd - fade))
    master.gain.linearRampToValueAtTime(0, onEnd)
    t = onEnd + off
  }
  source.start(when); safeStop(source, when + duration + 0.02)
  return { sources: [source], nodes: [source, notch1, notch2, master], duration, graph: 'Noise → notch Filters → gated Gain → Destination' }
}
