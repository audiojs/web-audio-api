// Euclidean rhythms: Drive 2-3 percussion voices from Bjorklund Euclidean rhythms, each with its own step and pulse count.
// CLI: npx web-audio-api euclidean 120 16 3,5,7 20s
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function seeded(seed = 0x4555434c) {
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

// Bjorklund's bucket-merging algorithm: distributes `pulses` as evenly as
// possible across `steps`, always starting on a pulse.
function bjorklund(pulses, steps) {
  pulses = Math.max(0, Math.min(steps, pulses | 0))
  if (pulses === 0) return new Array(steps).fill(false)
  if (pulses === steps) return new Array(steps).fill(true)
  let a = Array.from({ length: pulses }, () => [true])
  let b = Array.from({ length: steps - pulses }, () => [false])
  while (b.length > 1) {
    let n = Math.min(a.length, b.length)
    let merged = []
    for (let i = 0; i < n; i++) merged.push([...a[i], ...b[i]])
    let remainder = a.length > n ? a.slice(n) : b.slice(n)
    a = merged; b = remainder
  }
  return [...a, ...b].flat()
}

// A small room: decorrelated noise darkening as it decays, half a second long
function roomIR(ctx, random, seconds = 0.5) {
  let length = Math.ceil(ctx.sampleRate * seconds)
  let buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let channel = 0; channel < 2; channel++) {
    let data = buffer.getChannelData(channel), smooth = 0
    for (let i = 0; i < length; i++) {
      let t = i / length
      smooth += (1 - 0.9 * Math.sqrt(t)) * ((random() * 2 - 1) - smooth)
      data[i] = smooth * Math.exp(-6.9 * t) * (1 - Math.exp(-i / 30))
    }
  }
  return buffer
}

// Three drum voices, kick, snare, and hat, each carrying one Euclidean pattern. The kick is
// a sine with a fast pitch drop and a click, the snare two short tuned partials under a
// band-passed noise, the hat six square waves at the classic metallic ratios through a
// high band-pass. A compressor glues the kit and a short room places it.
export function init(ctx, {
  tempo = 120, steps = 16, pulses = '3,5,7', duration = 20, seed = 0x4555434c,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let random = seeded(seed)
  let voicePulses = String(pulses).split(',').map(Number).filter(n => Number.isFinite(n) && n >= 0).slice(0, 3)
  if (!voicePulses.length) voicePulses = [3, 5, 7]
  let patterns = voicePulses.map(p => bjorklund(p, steps))

  let sources = [], nodes = []
  let glue = ctx.createDynamicsCompressor()
  glue.threshold.value = -14; glue.ratio.value = 3; glue.attack.value = 0.004; glue.release.value = 0.12; glue.knee.value = 6
  let master = ctx.createGain(); master.gain.value = 0.8
  let bus = ctx.createGain(), room = ctx.createConvolver(), wet = ctx.createGain()
  room.buffer = roomIR(ctx, random)
  wet.gain.value = 0.16
  bus.connect(glue)
  bus.connect(room).connect(wet).connect(glue)
  glue.connect(master).connect(destination)
  nodes.push(glue, master, bus, room, wet)

  let noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate), ctx.sampleRate)
  let noiseData = noiseBuffer.getChannelData(0)
  for (let i = 0; i < noiseData.length; i++) noiseData[i] = random() * 2 - 1

  let panner = position => { let node = ctx.createStereoPanner(); node.pan.value = position; node.connect(bus); nodes.push(node); return node }
  let out = { kick: panner(0), snare: panner(-0.18), hat: panner(0.3) }

  let envelope = (time, peak, attack, decay, target) => {
    let gain = ctx.createGain()
    gain.gain.setValueAtTime(0, time)
    gain.gain.linearRampToValueAtTime(peak, time + attack)
    gain.gain.exponentialRampToValueAtTime(0.0005, time + attack + decay)
    gain.connect(target)
    nodes.push(gain)
    return gain
  }
  let burst = (time, duration, filters, gain) => {
    let source = ctx.createBufferSource()
    source.buffer = noiseBuffer
    let head = source
    for (let [type, frequency, q = 0.7] of filters) {
      let filter = ctx.createBiquadFilter()
      filter.type = type; filter.frequency.value = frequency; filter.Q.value = q
      head.connect(filter); head = filter; nodes.push(filter)
    }
    head.connect(gain)
    source.start(time, random() * (noiseBuffer.duration - duration - 0.05)); source.stop(time + duration)
    source.onended = () => gain.disconnect()
    sources.push(source); nodes.push(source)
  }

  let kick = (time, level) => {
    let osc = ctx.createOscillator()
    osc.frequency.setValueAtTime(170, time)
    osc.frequency.exponentialRampToValueAtTime(48, time + 0.07)
    let body = envelope(time, 0.55 * level, 0.0015, 0.32, out.kick)
    osc.connect(body)
    osc.start(time); safeStop(osc, time + 0.36)
    osc.onended = () => body.disconnect()
    sources.push(osc); nodes.push(osc)
    burst(time, 0.008, [['highpass', 1800]], envelope(time, 0.12 * level, 0.0005, 0.008, out.kick))
  }
  let snare = (time, level) => {
    for (let [frequency, amount] of [[185, 0.28], [330, 0.16]]) {
      let osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = frequency
      let shell = envelope(time, amount * level, 0.001, 0.12, out.snare)
      osc.connect(shell)
      osc.start(time); safeStop(osc, time + 0.14)
      osc.onended = () => shell.disconnect()
      sources.push(osc); nodes.push(osc)
    }
    burst(time, 0.2, [['highpass', 700], ['bandpass', 2200, 0.6]], envelope(time, 0.32 * level, 0.001, 0.19, out.snare))
  }
  let hat = (time, level, open) => {
    let shell = envelope(time, 0.16 * level, 0.0008, open ? 0.28 : 0.055, out.hat)
    let band = ctx.createBiquadFilter(), top = ctx.createBiquadFilter()
    band.type = 'bandpass'; band.frequency.value = 9000; band.Q.value = 0.9
    top.type = 'highpass'; top.frequency.value = 7000
    band.connect(top).connect(shell)
    nodes.push(band, top)
    let last
    for (let ratio of [2, 3, 4.16, 5.43, 6.79, 8.21]) {
      let osc = last = ctx.createOscillator(); osc.type = 'square'; osc.frequency.value = 40 * ratio
      osc.connect(band)
      osc.start(time); safeStop(osc, time + (open ? 0.3 : 0.07))
      sources.push(osc); nodes.push(osc)
    }
    last.onended = () => shell.disconnect()
  }
  let voices = [kick, snare, hat]

  let step = 60 / tempo / 4
  let elapsed = 0, stepIndex = 0
  let scheduleUntil = horizon => {
    while (elapsed < duration && elapsed < horizon) {
      let time = when + elapsed
      let downbeat = stepIndex % steps === 0
      for (let v = 0; v < patterns.length; v++) {
        if (!patterns[v][stepIndex % patterns[v].length]) continue
        let level = (downbeat ? 1 : 0.8) * (0.9 + random() * 0.2)
        voices[v](time, level, v === 2 && stepIndex % steps === steps - 2)
      }
      elapsed += step
      stepIndex++
    }
  }
  // Offline contexts render faster than wall clock, so every hit is scheduled
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
  return { sources, nodes, duration, graph: 'Euclidean patterns → percussion voices → Destination', data: { patterns } }
}
