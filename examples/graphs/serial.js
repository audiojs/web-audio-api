// Twelve-tone: Generate pointillistic music from prime, retrograde, inverse, and retrograde-inverse rows.
// CLI: npx web-audio-api serial 72 30s
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

function safeStop(source, time) {
  try { source.stop(time) } catch { return }
}

// A hall: decorrelated noise darkening as it decays
function hallIR(ctx, random, seconds = 2.6) {
  let length = Math.ceil(ctx.sampleRate * seconds)
  let buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let channel = 0; channel < 2; channel++) {
    let data = buffer.getChannelData(channel), smooth = 0
    for (let i = 0; i < length; i++) {
      let t = i / length
      smooth += (1 - 0.94 * Math.sqrt(t)) * ((random() * 2 - 1) - smooth)
      data[i] = smooth * Math.exp(-6.9 * t) * (1 - Math.exp(-i / 40))
    }
  }
  return buffer
}

// The row is stated in its four classical forms in turn: prime, retrograde, inversion, and
// retrograde inversion, each transposed to start where the last form ended, so the pitch
// classes always cycle. Every note is a point: one of three timbres (an FM bell, a pluck, a
// breathy flute), a dynamic from ppp to f, a register from low to high, placed across the
// stereo field by register, in a hall.
export function init(ctx, {
  tempo = 78, duration = 5, seed = 0x53455249, when = ctx.currentTime,
  destination = ctx.destination,
} = {}) {
  let random = seeded(seed), row = Array.from({ length: 12 }, (_, i) => i)
  for (let i = row.length - 1; i > 0; i--) { let j = random() * (i + 1) | 0; [row[i], row[j]] = [row[j], row[i]] }
  let forms = [
    row,
    [...row].reverse(),
    row.map(note => (24 - note + row[0] * 2) % 12),
    row.map(note => (24 - note + row[0] * 2) % 12).reverse(),
  ]
  let sources = [], nodes = []
  let master = ctx.createGain(); master.gain.value = 0.9
  let bus = ctx.createGain(), dry = ctx.createGain(), hall = ctx.createConvolver(), wet = ctx.createGain()
  hall.buffer = hallIR(ctx, random)
  wet.gain.value = 0.34
  bus.connect(dry).connect(master)
  bus.connect(hall).connect(wet).connect(master)
  master.connect(destination)
  nodes.push(master, bus, dry, hall, wet)

  let place = (frequency, target) => {
    let panner = ctx.createStereoPanner()
    panner.pan.value = Math.max(-0.8, Math.min(0.8, Math.log2(frequency / 261.63) / 3))
    panner.connect(target); nodes.push(panner)
    return panner
  }
  let envelope = (time, peak, attack, hold, release, target) => {
    let gain = ctx.createGain()
    gain.gain.setValueAtTime(0, time)
    gain.gain.linearRampToValueAtTime(peak, time + attack)
    gain.gain.setValueAtTime(peak, time + attack + hold)
    gain.gain.exponentialRampToValueAtTime(0.0005, time + attack + hold + release)
    gain.connect(target); nodes.push(gain)
    return gain
  }

  // FM bell: a sine carrier, a modulator at a bell-like ratio whose depth falls with the tone
  let bell = (frequency, time, length, level) => {
    let carrier = ctx.createOscillator(), modulator = ctx.createOscillator(), depth = ctx.createGain()
    carrier.frequency.value = frequency
    modulator.frequency.value = frequency * (random() < 0.5 ? 3.5 : 1.4)
    depth.gain.setValueAtTime(frequency * 2.4, time)
    depth.gain.exponentialRampToValueAtTime(frequency * 0.08, time + length)
    modulator.connect(depth).connect(carrier.frequency)
    let amp = envelope(time, level, 0.003, 0, length, place(frequency, bus))
    carrier.connect(amp)
    carrier.start(time); modulator.start(time)
    safeStop(carrier, time + length + 0.01); safeStop(modulator, time + length + 0.01)
    carrier.onended = () => amp.disconnect()
    sources.push(carrier, modulator); nodes.push(carrier, modulator, depth)
  }
  // Pluck: a saw and a triangle through a low-pass whose cutoff drops fast, like a damped string
  let pluck = (frequency, time, length, level) => {
    let filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'; filter.Q.value = 2
    filter.frequency.setValueAtTime(Math.min(ctx.sampleRate * 0.4, frequency * 12), time)
    filter.frequency.exponentialRampToValueAtTime(frequency * 1.2, time + Math.min(length, 0.35))
    let amp = envelope(time, level, 0.002, 0, Math.min(length, 0.9), place(frequency, bus))
    filter.connect(amp); nodes.push(filter)
    let last
    for (let [type, amount] of [['sawtooth', 0.5], ['triangle', 0.5]]) {
      let osc = last = ctx.createOscillator(), gain = ctx.createGain()
      osc.type = type; osc.frequency.value = frequency
      gain.gain.value = amount
      osc.connect(gain).connect(filter)
      osc.start(time); safeStop(osc, time + Math.min(length, 0.9) + 0.01)
      sources.push(osc); nodes.push(osc, gain)
    }
    last.onended = () => amp.disconnect()
  }
  // Breath: a sine with a little second harmonic, a slow onset, vibrato arriving late
  let breath = (frequency, time, length, level) => {
    let attack = Math.min(0.06, length / 3), release = Math.min(0.25, length / 2)
    let amp = envelope(time, level, attack, Math.max(0, length - attack - release), release, place(frequency, bus))
    let vibrato = ctx.createOscillator(), vibratoDepth = ctx.createGain()
    vibrato.frequency.value = 5.2 + random()
    vibratoDepth.gain.setValueAtTime(0, time)
    vibratoDepth.gain.linearRampToValueAtTime(7, time + length * 0.6)
    vibrato.connect(vibratoDepth)
    let last
    for (let [ratio, amount] of [[1, 0.8], [2, 0.2]]) {
      let osc = last = ctx.createOscillator(), gain = ctx.createGain()
      osc.frequency.value = frequency * ratio
      gain.gain.value = amount
      vibratoDepth.connect(osc.detune)
      osc.connect(gain).connect(amp)
      osc.start(time); safeStop(osc, time + length + 0.01)
      sources.push(osc); nodes.push(osc, gain)
    }
    vibrato.start(time); safeStop(vibrato, time + length + 0.01)
    sources.push(vibrato); nodes.push(vibrato, vibratoDepth)
    last.onended = () => amp.disconnect()
  }
  let timbres = [bell, pluck, breath]

  let beat = 60 / tempo, time = when, index = 0
  let scheduleUntil = horizon => {
    while (time < when + duration && time < horizon) {
      let form = forms[Math.floor(index / 12) % 4], note = form[index % 12]
      let octave = 2 + (random() * 4 | 0)
      let frequency = 16.35 * 2 ** ((note + octave * 12) / 12)
      let length = beat * (0.3 + random() * 0.9)
      let level = 0.07 * 4 ** random() // ppp to f
      timbres[random() * 3 | 0](frequency, time, length, level)
      time += random() < 0.3 ? beat * (0.25 + random() * 0.5) : length + beat * random() * 0.6
      index++
    }
  }
  // Offline contexts render faster than wall clock, so every note is scheduled upfront;
  // live contexts get a rolling lookahead window, keeping the node count bounded however
  // long the piece runs
  if (typeof ctx.startRendering === 'function') scheduleUntil(when + duration)
  else {
    let lookahead = 4
    scheduleUntil(ctx.currentTime + lookahead)
    let timer = setInterval(() => {
      if (ctx.state !== 'running' || time >= when + duration) return clearInterval(timer)
      scheduleUntil(ctx.currentTime + lookahead)
    }, 500)
  }
  return { sources, nodes, duration, graph: 'Twelve-tone row → scheduled voices → Destination', data: { row } }
}
