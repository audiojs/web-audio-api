// Gamelan: Schedule interlocking slendro patterns with metalophone partials and gong structure.
// CLI: npx web-audio-api gamelan 120 20s
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function seeded(seed = 0x47414d45) {
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

// A pendopo: a stereo impulse response of decorrelated noise, darkening as it decays
function hallIR(ctx, random, seconds = 2.2) {
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

// A sixteen-beat gongan in the lancaran form. The balungan (skeleton melody) is played on
// every beat by the saron family, the peking doubles it with alternating neighbours, and the
// colotomic instruments mark the form: kethuk between beats, kenong every fourth beat, kempul
// every fourth beat offset by two (the first left silent), and the great gong closing the
// cycle. Slendro is five near-equal steps of about 240 cents.
export function init(ctx, {
  tempo = 120, duration = 20, seed = 0x47414d45, when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let random = seeded(seed)
  let sources = [], nodes = []
  let master = ctx.createGain(); master.gain.value = 0.8
  let bus = ctx.createGain(), dry = ctx.createGain(), hall = ctx.createConvolver(), wet = ctx.createGain()
  hall.buffer = hallIR(ctx, random)
  wet.gain.value = 0.3
  bus.connect(dry).connect(master)
  bus.connect(hall).connect(wet).connect(master)
  master.connect(destination)
  nodes.push(master, bus, dry, hall, wet)

  let tonic = 277.18 // a low saron "nem"
  let slendro = degree => tonic * 2 ** (Math.floor(degree / 5) + (degree - 5 * Math.floor(degree / 5)) * 240 / 1200)

  // balungan: four gatras of four notes, mostly stepwise, each gatra settling on a strong tone
  let balungan = [], note = 2
  for (let gatra = 0; gatra < 4; gatra++) {
    for (let i = 0; i < 3; i++) { note += random() < 0.65 ? (random() < 0.5 ? -1 : 1) : (random() < 0.5 ? -2 : 2); note = Math.max(0, Math.min(6, note)); balungan.push(note) }
    note = [0, 2, 4, 5][gatra % 2 ? random() * 4 | 0 : 0 + (random() * 2 | 0) * 2]
    balungan.push(note)
  }

  let panner = (position, target) => { let node = ctx.createStereoPanner(); node.pan.value = position; node.connect(target); nodes.push(node); return node }
  let sections = { saron: panner(-0.2, bus), demung: panner(0.15, bus), peking: panner(0.45, bus), kethuk: panner(-0.5, bus), kenong: panner(0.55, bus), kempul: panner(-0.35, bus), gong: panner(0, bus) }

  // struck bar or gong: modes as [ratio, amount, decay share], the higher ones dying first,
  // with a soft mallet onset and a felt-lined contact noise
  let noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.5), ctx.sampleRate)
  let noise = noiseBuffer.getChannelData(0)
  for (let i = 0; i < noise.length; i++) noise[i] = random() * 2 - 1
  let strike = (time, frequency, { modes, decay, level, attack = 0.003, contact = 0.05, contactColor = 2500, target, beat = 0 }) => {
    let body = ctx.createGain()
    body.gain.setValueAtTime(0, time)
    body.gain.linearRampToValueAtTime(level, time + attack)
    body.connect(target)
    nodes.push(body)
    let last = null
    for (let [ratio, amount, share = 1] of modes) {
      let osc = ctx.createOscillator(), partial = ctx.createGain()
      osc.frequency.value = Math.min(ctx.sampleRate * 0.45, frequency * ratio)
      if (beat && ratio === 1) osc.detune.value = -1200 * Math.log2(1 + beat / frequency) // the twin partial that makes the ombak
      let end = time + attack + decay * share
      partial.gain.setValueAtTime(amount, time)
      partial.gain.exponentialRampToValueAtTime(amount * 0.001, end)
      osc.connect(partial).connect(body)
      osc.start(time); safeStop(osc, end + 0.01)
      sources.push(osc); nodes.push(osc, partial)
      if (!last || end > last.end) last = { osc, end }
    }
    last.osc.onended = () => body.disconnect()
    if (contact) {
      let burst = ctx.createBufferSource(), color = ctx.createBiquadFilter(), envelope = ctx.createGain()
      burst.buffer = noiseBuffer
      color.type = 'lowpass'; color.frequency.value = contactColor
      envelope.gain.setValueAtTime(0, time)
      envelope.gain.linearRampToValueAtTime(contact * level, time + 0.001)
      envelope.gain.exponentialRampToValueAtTime(0.0005, time + 0.012)
      burst.connect(color).connect(envelope).connect(target)
      burst.start(time, random() * 0.4); burst.stop(time + 0.012)
      burst.onended = () => envelope.disconnect()
      sources.push(burst); nodes.push(burst, color, envelope)
    }
  }
  let bar = [[1, 1], [2.76, 0.32, 0.4], [5.4, 0.14, 0.2], [8.93, 0.05, 0.1]]
  let gongModes = [[1, 1], [1, 0.9], [1.51, 0.25, 0.6], [2.0, 0.18, 0.5], [2.47, 0.1, 0.4], [3.6, 0.05, 0.3]]
  let humanize = time => Math.max(when, time + (random() - 0.5) * 0.012)
  let touch = () => 0.85 + random() * 0.3

  let beat = 60 / tempo
  let instruments = {
    saron: (time, degree) => strike(time, slendro(degree + 5), { modes: bar, decay: 1.4, level: 0.16 * touch(), target: sections.saron, contactColor: 3000 }),
    demung: (time, degree) => strike(time, slendro(degree), { modes: bar, decay: 2, level: 0.14 * touch(), target: sections.demung, contactColor: 1800 }),
    peking: (time, degree) => strike(time, slendro(degree + 10), { modes: bar, decay: 0.5, level: 0.07 * touch(), target: sections.peking, attack: 0.002, contactColor: 5000 }),
    kethuk: time => strike(time, slendro(2) / 2, { modes: [[1, 1], [1.5, 0.3, 0.5], [2.3, 0.1, 0.3]], decay: 0.25, level: 0.1, target: sections.kethuk, contact: 0.08, contactColor: 1200 }),
    kenong: time => strike(time, slendro(4), { modes: [[1, 1], [1.54, 0.35, 0.7], [2.06, 0.2, 0.5], [2.6, 0.08, 0.4]], decay: 2.6, level: 0.13, attack: 0.006, target: sections.kenong, contact: 0.03, contactColor: 900, beat: 1.2 }),
    kempul: time => strike(time, slendro(0) / 2, { modes: gongModes, decay: 3.2, level: 0.16, attack: 0.012, target: sections.kempul, contact: 0.02, contactColor: 500, beat: 1.8 }),
    gong: time => strike(time, slendro(0) / 4, { modes: gongModes, decay: 7, level: 0.3, attack: 0.03, target: sections.gong, contact: 0.015, contactColor: 300, beat: 1.4 }),
  }

  let step = 0
  let scheduleUntil = horizon => {
    for (; step * beat < duration && step * beat < horizon; step++) {
      let position = step % 16, time = when + step * beat
      let degree = balungan[position], next = balungan[(position + 1) % 16]
      instruments.saron(humanize(time), degree)
      instruments.demung(humanize(time), degree)
      // peking nacah: two strokes per beat alternating the note with its neighbour
      instruments.peking(humanize(time), degree)
      instruments.peking(humanize(time + beat / 2), next)
      if (position % 2 === 1 && position % 4 !== 3) instruments.kethuk(time + beat / 2)
      if (position % 4 === 3) instruments.kenong(time)
      if (position % 4 === 1 && position !== 1) instruments.kempul(time)
      if (position === 15) instruments.gong(time)
      if (step === 0) instruments.gong(time) // the piece opens on the gong
    }
  }
  // Offline contexts render faster than wall clock, so every stroke is scheduled upfront;
  // live contexts get a rolling lookahead window, keeping the node count bounded however
  // long the piece runs
  if (typeof ctx.startRendering === 'function') scheduleUntil(duration)
  else {
    let lookahead = 4
    scheduleUntil(ctx.currentTime - when + lookahead)
    let timer = setInterval(() => {
      if (ctx.state !== 'running' || step * beat >= duration) return clearInterval(timer)
      scheduleUntil(ctx.currentTime - when + lookahead)
    }, 500)
  }
  return { sources, nodes, duration, graph: 'Slendro scheduler → metallic partials → Destination', data: { balungan } }
}
