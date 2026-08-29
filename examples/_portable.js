// Runtime-neutral Web Audio graph cores used by the website and CLI wrappers.
// The caller supplies the context and owns resume/close, input/output adapters, and UI.

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

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
  try { source.stop(time) } catch {}
}

export function stopPortable(demo, time = 0) {
  if (!demo) return
  for (let source of demo.sources || []) safeStop(source, time)
  for (let node of demo.nodes || []) {
    try { node.disconnect() } catch {}
  }
}

export function buildTone(ctx, {
  frequency = 440, waveform = 'sine', duration = 2, gain = 0.24,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let osc = ctx.createOscillator()
  let master = ctx.createGain()
  osc.type = waveform
  osc.frequency.value = frequency
  master.gain.value = gain
  osc.connect(master).connect(destination)
  osc.start(when)
  fadeOut(master.gain, when, duration, gain)
  safeStop(osc, when + duration + 0.01)
  return result({ sources: [osc], nodes: [osc, master], duration, graph: 'Oscillator → Gain → Destination' })
}

export function buildSweep(ctx, {
  from = 80, to = 8000, mode = 'exponential', duration = 3, gain = 0.2,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  from = Math.max(1, from)
  to = Math.max(1, to)
  let osc = ctx.createOscillator()
  let master = ctx.createGain()
  osc.frequency.setValueAtTime(from, when)
  if (mode === 'linear') osc.frequency.linearRampToValueAtTime(to, when + duration)
  else osc.frequency.exponentialRampToValueAtTime(to, when + duration)
  master.gain.setValueAtTime(0, when)
  master.gain.linearRampToValueAtTime(gain, when + Math.min(0.08, duration / 8))
  fadeOut(master.gain, when, duration, gain)
  osc.connect(master).connect(destination)
  osc.start(when)
  safeStop(osc, when + duration + 0.01)
  return result({ sources: [osc], nodes: [osc, master], duration, graph: 'Oscillator.frequency automation → Gain → Destination' })
}

export function buildNoise(ctx, {
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

export function buildImpulse(ctx, {
  count = 3, interval = 0.45, gain = 0.35, when = ctx.currentTime,
  destination = ctx.destination,
} = {}) {
  let buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
  buffer.getChannelData(0)[0] = gain
  let sources = []
  for (let i = 0; i < count; i++) {
    let source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(destination)
    source.start(when + i * interval)
    sources.push(source)
  }
  return result({ sources, nodes: [...sources], duration: Math.max(0.5, (count - 1) * interval + 0.4), graph: 'One-sample AudioBuffer → Destination' })
}

const dtmfLow = { 1:697,2:697,3:697,A:697, 4:770,5:770,6:770,B:770, 7:852,8:852,9:852,C:852, '*':941,0:941,'#':941,D:941 }
const dtmfHigh = { 1:1209,2:1336,3:1477,A:1633, 4:1209,5:1336,6:1477,B:1633, 7:1209,8:1336,9:1477,C:1633, '*':1209,0:1336,'#':1477,D:1633 }

export function scheduleDtmfDigit(ctx, digit, {
  when = ctx.currentTime, duration = 0.12, gain = 0.15, destination = ctx.destination,
} = {}) {
  if (!dtmfLow[digit]) return result({ duration: 0, graph: 'Invalid DTMF digit' })
  let sources = [], nodes = []
  for (let frequency of [dtmfLow[digit], dtmfHigh[digit]]) {
    let osc = ctx.createOscillator()
    let env = ctx.createGain()
    osc.frequency.value = frequency
    env.gain.setValueAtTime(0, when)
    env.gain.linearRampToValueAtTime(gain, when + 0.005)
    env.gain.setValueAtTime(gain, when + duration - 0.008)
    env.gain.linearRampToValueAtTime(0, when + duration)
    osc.connect(env).connect(destination)
    osc.start(when)
    safeStop(osc, when + duration + 0.01)
    sources.push(osc); nodes.push(osc, env)
  }
  return result({ sources, nodes, duration, graph: '2 Oscillators → Envelope → Destination' })
}

export function buildDtmf(ctx, {
  digits = '5551234', speed = 0.13, when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let sources = [], nodes = [], time = when
  for (let digit of digits.toUpperCase()) {
    let voice = scheduleDtmfDigit(ctx, digit, { when: time, duration: speed, destination })
    sources.push(...voice.sources); nodes.push(...voice.nodes)
    time += speed * 1.7
  }
  return result({ sources, nodes, duration: Math.max(0.3, time - when), graph: 'DTMF oscillator pairs → envelopes → Destination' })
}

export function buildStereoTest(ctx, {
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
  return result({ sources, nodes, duration: time - when, graph: 'Oscillator → StereoPanner → Envelope → Destination' })
}

export function buildMetronome(ctx, {
  bpm = '80..240', pattern = 'X-x-x-x-', duration = 600, sound = 'classic',
  hi = 1900, lo = 1250, when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let [startBpm, endBpm] = String(bpm).split('..').map(Number)
  if (!Number.isFinite(startBpm) || startBpm <= 0) startBpm = 80
  if (!Number.isFinite(endBpm) || endBpm <= 0) endBpm = startBpm
  if (!pattern) pattern = 'X-x-x-x-'
  let sources = [], nodes = [], elapsed = 0, step = 0
  while (elapsed < duration) {
    let progress = Math.min(1, elapsed / Math.max(duration, 0.001))
    let tempo = startBpm + (endBpm - startBpm) * progress
    let mark = pattern[step % pattern.length]
    if (mark !== '-' && mark !== '.') {
      let time = when + elapsed, strong = mark === 'X'
      let osc = ctx.createOscillator(), env = ctx.createGain()
      let frequencies = {
        classic: strong ? hi : lo,
        wood: strong ? 1050 : 760,
        bell: strong ? 1760 : 1320,
        beep: strong ? 1100 : 760,
        signal: strong ? 1000 : 800,
      }
      let frequency = frequencies[sound] || frequencies.classic
      osc.type = sound === 'beep' ? 'square' : sound === 'wood' ? 'triangle' : 'sine'
      osc.frequency.setValueAtTime(frequency, time)
      if (sound !== 'signal') osc.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 0.55), time + 0.025)
      let decay = sound === 'bell' ? 0.16 : sound === 'signal' ? 0.07 : 0.045
      env.gain.setValueAtTime(strong ? 0.27 : 0.16, time)
      env.gain.exponentialRampToValueAtTime(0.001, time + decay)
      osc.connect(env).connect(destination)
      osc.start(time); safeStop(osc, time + decay + 0.01)
      sources.push(osc); nodes.push(osc, env)
    }
    elapsed += 30 / Math.max(20, tempo)
    step++
  }
  return result({ sources, nodes, duration, graph: 'Audio-clock click scheduler → Destination' })
}

export function buildShepard(ctx, {
  direction = 'up', duration = 4, rate = 0.35, center = 440,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let sign = direction === 'down' ? -1 : 1
  let sources = [], nodes = []
  let master = ctx.createGain(); master.gain.value = 0.12
  master.connect(destination); nodes.push(master)
  for (let voice = 0; voice < 7; voice++) {
    let osc = ctx.createOscillator()
    let amp = ctx.createGain()
    let octave = voice - 3
    let start = center * 2 ** octave
    let end = start * 2 ** (sign * rate * duration)
    osc.frequency.setValueAtTime(clamp(start, 20, ctx.sampleRate * 0.4), when)
    osc.frequency.exponentialRampToValueAtTime(clamp(end, 20, ctx.sampleRate * 0.4), when + duration)
    let distance = Math.abs(octave) / 3
    amp.gain.value = Math.exp(-distance * distance * 1.8)
    osc.connect(amp).connect(master)
    osc.start(when); safeStop(osc, when + duration + 0.01)
    sources.push(osc); nodes.push(osc, amp)
  }
  fadeOut(master.gain, when, duration, 0.12)
  return result({ sources, nodes, duration, graph: 'Octave-spaced oscillator bank → weighted mix → Destination' })
}

export function buildRissetRhythm(ctx, {
  direction = 'up', bpm = 110, duration = 5, when = ctx.currentTime,
  destination = ctx.destination,
} = {}) {
  let sign = direction === 'down' ? -1 : 1
  let sources = [], nodes = [], voices = 5, period = 7
  for (let voice = 0; voice < voices; voice++) {
    let offset = voice / voices
    for (let t = 0; t < duration;) {
      let phase = ((t / period * sign + offset) % 1 + 1) % 1
      let tempo = bpm * 2 ** phase
      let amp = Math.exp(-0.5 * ((phase - 0.5) / 0.34) ** 2)
      if (amp > 0.04) {
        let time = when + t
        let osc = ctx.createOscillator(), env = ctx.createGain()
        osc.frequency.setValueAtTime(1000, time)
        osc.frequency.exponentialRampToValueAtTime(360, time + 0.025)
        env.gain.setValueAtTime(amp * 0.13, time)
        env.gain.exponentialRampToValueAtTime(0.001, time + 0.055)
        osc.connect(env).connect(destination)
        osc.start(time); safeStop(osc, time + 0.07)
        sources.push(osc); nodes.push(osc, env)
      }
      t += 60 / tempo
    }
  }
  return result({ sources, nodes, duration, graph: 'Layered tempo cycles → click envelopes → Destination' })
}

export function buildBinaural(ctx, {
  frequency = 200, difference = 8, duration = 4, gain = 0.14,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let left = ctx.createOscillator(), right = ctx.createOscillator()
  let panLeft = ctx.createStereoPanner(), panRight = ctx.createStereoPanner()
  let master = ctx.createGain()
  left.frequency.value = frequency; right.frequency.value = frequency + difference
  panLeft.pan.value = -1; panRight.pan.value = 1; master.gain.value = gain
  left.connect(panLeft).connect(master); right.connect(panRight).connect(master); master.connect(destination)
  left.start(when); right.start(when)
  fadeOut(master.gain, when, duration, gain)
  safeStop(left, when + duration + 0.01); safeStop(right, when + duration + 0.01)
  return result({ sources: [left, right], nodes: [left, right, panLeft, panRight, master], duration, graph: '2 Oscillators → hard L/R pan → Destination' })
}

export function buildMissingFundamental(ctx, {
  frequency = 100, duration = 3, gain = 0.12, when = ctx.currentTime,
  destination = ctx.destination,
} = {}) {
  let master = ctx.createGain(); master.gain.value = gain; master.connect(destination)
  let sources = [], nodes = [master]
  for (let harmonic = 2; harmonic <= 6; harmonic++) {
    let osc = ctx.createOscillator(), level = ctx.createGain()
    osc.frequency.value = frequency * harmonic
    level.gain.value = 1 / harmonic
    osc.connect(level).connect(master)
    osc.start(when); safeStop(osc, when + duration + 0.01)
    sources.push(osc); nodes.push(osc, level)
  }
  fadeOut(master.gain, when, duration, gain)
  return result({ sources, nodes, duration, graph: 'Harmonics 2–6 → weighted mix → Destination' })
}

export function buildBeating(ctx, {
  frequency = 440, difference = 3, duration = 4, gain = 0.14,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let a = ctx.createOscillator(), b = ctx.createOscillator(), master = ctx.createGain()
  a.frequency.value = frequency; b.frequency.value = frequency + difference; master.gain.value = gain
  a.connect(master); b.connect(master); master.connect(destination)
  a.start(when); b.start(when); fadeOut(master.gain, when, duration, gain)
  safeStop(a, when + duration + 0.01); safeStop(b, when + duration + 0.01)
  return result({ sources: [a, b], nodes: [a, b, master], duration, graph: '2 nearby Oscillators → Gain → Destination' })
}

export function buildSubtractive(ctx, {
  frequency = 220, duration = 2.5, when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let osc = ctx.createOscillator(), filter = ctx.createBiquadFilter(), env = ctx.createGain()
  osc.type = 'sawtooth'; osc.frequency.value = frequency
  filter.type = 'lowpass'; filter.Q.value = 8
  filter.frequency.setValueAtTime(180, when)
  filter.frequency.linearRampToValueAtTime(3600, when + Math.min(0.35, duration / 4))
  filter.frequency.exponentialRampToValueAtTime(220, when + duration * 0.8)
  env.gain.setValueAtTime(0, when)
  env.gain.linearRampToValueAtTime(0.25, when + 0.015)
  env.gain.linearRampToValueAtTime(0.16, when + 0.14)
  env.gain.setValueAtTime(0.16, when + duration * 0.75)
  env.gain.linearRampToValueAtTime(0, when + duration)
  osc.connect(filter).connect(env).connect(destination)
  osc.start(when); safeStop(osc, when + duration + 0.01)
  return result({ sources: [osc], nodes: [osc, filter, env], duration, graph: 'Sawtooth → BiquadFilter → ADSR Gain → Destination' })
}

export function buildAdditive(ctx, {
  waveform = 'square', frequency = 220, harmonics = 14, duration = 3,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let master = ctx.createGain(); master.gain.value = 0.22; master.connect(destination)
  let sources = [], nodes = [master]
  let amplitude = harmonic => waveform === 'square' ? (harmonic % 2 ? 1 / harmonic : 0)
    : waveform === 'triangle' ? (harmonic % 2 ? (-1) ** ((harmonic - 1) / 2) / (harmonic * harmonic) : 0)
    : 1 / harmonic
  for (let harmonic = 1; harmonic <= harmonics; harmonic++) {
    let value = amplitude(harmonic)
    if (Math.abs(value) < 0.001 || frequency * harmonic >= ctx.sampleRate * 0.45) continue
    let osc = ctx.createOscillator(), level = ctx.createGain()
    osc.frequency.value = frequency * harmonic; level.gain.value = value
    osc.connect(level).connect(master); osc.start(when); safeStop(osc, when + duration + 0.01)
    sources.push(osc); nodes.push(osc, level)
  }
  fadeOut(master.gain, when, duration, 0.22)
  return result({ sources, nodes, duration, graph: 'Harmonic oscillator bank → weighted mix → Destination' })
}

export function buildFM(ctx, {
  carrier = 220, ratio = 2, index = 4, duration = 3, when = ctx.currentTime,
  destination = ctx.destination,
} = {}) {
  let mod = ctx.createOscillator(), modGain = ctx.createGain(), car = ctx.createOscillator(), master = ctx.createGain()
  mod.frequency.value = carrier * ratio; modGain.gain.value = index * carrier * ratio
  car.frequency.value = carrier; master.gain.value = 0.2
  mod.connect(modGain).connect(car.frequency); car.connect(master).connect(destination)
  mod.start(when); car.start(when); fadeOut(master.gain, when, duration, 0.2)
  safeStop(mod, when + duration + 0.01); safeStop(car, when + duration + 0.01)
  return result({ sources: [mod, car], nodes: [mod, modGain, car, master], duration, graph: 'Modulator → Carrier.frequency → Gain → Destination' })
}

export function buildKarplusStrong(ctx, {
  frequency = 220, duration = 3, seed = 0x4b535452, when = ctx.currentTime,
  destination = ctx.destination,
} = {}) {
  let random = seeded(seed), ringLength = Math.max(2, Math.round(ctx.sampleRate / frequency))
  let ring = new Float32Array(ringLength)
  for (let i = 0; i < ring.length; i++) ring[i] = random() * 2 - 1
  let length = Math.ceil(ctx.sampleRate * duration)
  let buffer = ctx.createBuffer(1, length, ctx.sampleRate), out = buffer.getChannelData(0)
  for (let i = 0, pos = 0; i < out.length; i++) {
    let next = (pos + 1) % ring.length
    ring[pos] = (ring[pos] + ring[next]) * 0.498
    out[i] = ring[pos]
    pos = next
  }
  let source = ctx.createBufferSource(), master = ctx.createGain()
  source.buffer = buffer; master.gain.value = 0.42
  source.connect(master).connect(destination); source.start(when); safeStop(source, when + duration + 0.01)
  return result({ sources: [source], nodes: [source, master], duration, graph: 'Noise ring buffer → feedback average → Destination' })
}

export function buildSequencer(ctx, {
  bpm = 140, duration = null, loops = 1, when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let notes = [440, 0, 523.25, 0, 587.33, 0, 659.25, 0, 587.33, 523.25, 440, 0, 329.63, 0, 440, 0]
  let step = 60 / bpm / 4, sources = [], nodes = []
  let totalDuration = duration ?? notes.length * loops * step
  let loopCount = Math.ceil(totalDuration / (notes.length * step))
  for (let loop = 0; loop < loopCount; loop++) for (let i = 0; i < notes.length; i++) {
    if (!notes[i]) continue
    let time = when + (loop * notes.length + i) * step
    if (time >= when + totalDuration) continue
    let osc = ctx.createOscillator(), env = ctx.createGain()
    osc.type = 'square'; osc.frequency.value = notes[i]
    env.gain.setValueAtTime(0, time); env.gain.linearRampToValueAtTime(0.18, time + 0.006)
    env.gain.exponentialRampToValueAtTime(0.001, Math.min(time + step * 0.88, when + totalDuration))
    osc.connect(env).connect(destination); osc.start(time); safeStop(osc, Math.min(time + step, when + totalDuration) + 0.01)
    sources.push(osc); nodes.push(osc, env)
  }
  return result({ sources, nodes, duration: totalDuration, graph: '16-step audio-clock scheduler → envelopes → Destination' })
}

export function buildSerial(ctx, {
  tempo = 78, duration = 5, seed = 0x53455249, when = ctx.currentTime,
  destination = ctx.destination,
} = {}) {
  let random = seeded(seed), row = Array.from({ length: 12 }, (_, i) => i)
  for (let i = row.length - 1; i > 0; i--) { let j = random() * (i + 1) | 0; [row[i], row[j]] = [row[j], row[i]] }
  let beat = 60 / tempo, sources = [], nodes = [], time = when
  for (let i = 0; time < when + duration; i++) {
    let note = row[i % row.length], octave = 2 + (random() * 4 | 0)
    let frequency = 16.35 * 2 ** ((note + octave * 12) / 12), noteDuration = beat * (0.35 + random() * 0.65)
    let osc = ctx.createOscillator(), env = ctx.createGain()
    osc.type = ['sine', 'triangle', 'square'][random() * 3 | 0]; osc.frequency.value = frequency
    env.gain.setValueAtTime(0, time); env.gain.linearRampToValueAtTime(0.12, time + 0.01)
    env.gain.exponentialRampToValueAtTime(0.001, time + noteDuration)
    osc.connect(env).connect(destination); osc.start(time); safeStop(osc, time + noteDuration + 0.01)
    sources.push(osc); nodes.push(osc, env); time += noteDuration + beat * random() * 0.4
  }
  return result({ sources, nodes, duration, graph: 'Twelve-tone row → scheduled voices → Destination', data: { row } })
}

export function buildGamelan(ctx, {
  tempo = 126, duration = 5, when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let scale = [0, 240, 480, 720, 960].map(cents => 440 * 2 ** (cents / 1200))
  let melody = [0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 4, 3, 2, 1, 0, 1]
  let beat = 60 / tempo, sources = [], nodes = []
  for (let i = 0; i * beat < duration; i++) {
    let time = when + i * beat, frequency = scale[melody[i % melody.length]] * (i % 2 ? 1 : 2)
    let env = ctx.createGain(); env.gain.setValueAtTime(0, time); env.gain.linearRampToValueAtTime(0.14, time + 0.003)
    env.gain.exponentialRampToValueAtTime(0.001, time + beat * 2.5); env.connect(destination)
    for (let [ratio, amount] of [[1, 1], [2.76, 0.14]]) {
      let osc = ctx.createOscillator(), level = ctx.createGain(); osc.frequency.value = frequency * ratio; level.gain.value = amount
      osc.connect(level).connect(env); osc.start(time); safeStop(osc, time + beat * 2.6)
      sources.push(osc); nodes.push(osc, level)
    }
    nodes.push(env)
  }
  return result({ sources, nodes, duration, graph: 'Slendro scheduler → metallic partials → Destination' })
}

export function buildDrone(ctx, {
  frequency = 130.81, duration = 5, seed = 0x44524f4e, when = ctx.currentTime,
  destination = ctx.destination,
} = {}) {
  let random = seeded(seed), master = ctx.createGain(); master.gain.value = 0.055; master.connect(destination)
  let sources = [], nodes = [master]
  for (let ratio of [1.5, 1, 1.001, 0.5]) for (let harmonic = 1; harmonic <= 7; harmonic++) {
    let osc = ctx.createOscillator(), level = ctx.createGain()
    osc.frequency.value = frequency * ratio * harmonic * (1 + (random() - 0.5) * 0.0005)
    level.gain.value = 1 / harmonic
    osc.connect(level).connect(master); osc.start(when); safeStop(osc, when + duration + 0.01)
    sources.push(osc); nodes.push(osc, level)
  }
  master.gain.setValueAtTime(0, when); master.gain.linearRampToValueAtTime(0.055, when + 0.25)
  fadeOut(master.gain, when, duration, 0.055)
  return result({ sources, nodes, duration, graph: 'Detuned harmonic banks → Master Gain → Destination' })
}

export function buildJazz(ctx, {
  bpm = 92, duration = 7, seed = 0x4a415a5a, when = ctx.currentTime,
  destination = ctx.destination,
} = {}) {
  let random = seeded(seed), beat = 60 / bpm, sources = [], nodes = []
  let master = ctx.createGain(); master.gain.value = 0.26; master.connect(destination); nodes.push(master)
  let roots = [146.83, 196, 174.61, 130.81]
  for (let chord = 0; chord < roots.length; chord++) {
    let start = when + chord * beat * 4, end = Math.min(when + duration, start + beat * 4)
    for (let semitone of [0, 3, 7, 10, 14]) {
      let osc = ctx.createOscillator(), env = ctx.createGain()
      osc.type = 'triangle'; osc.frequency.value = roots[chord] * 2 ** (semitone / 12)
      env.gain.setValueAtTime(0, start); env.gain.linearRampToValueAtTime(0.06, start + 0.15)
      env.gain.setValueAtTime(0.06, Math.max(start + 0.16, end - 0.25)); env.gain.linearRampToValueAtTime(0, end)
      osc.connect(env).connect(master); osc.start(start); safeStop(osc, end + 0.01)
      sources.push(osc); nodes.push(osc, env)
    }
    for (let step = 0; step < 4 && start + step * beat < when + duration; step++) {
      let time = start + step * beat, bass = ctx.createOscillator(), env = ctx.createGain()
      bass.type = 'sine'; bass.frequency.value = roots[chord] / 2 * 2 ** ([0, 3, 5, 7][step] / 12)
      env.gain.setValueAtTime(0.12, time); env.gain.exponentialRampToValueAtTime(0.001, time + beat * 0.8)
      bass.connect(env).connect(master); bass.start(time); safeStop(bass, time + beat)
      sources.push(bass); nodes.push(bass, env)
      if (random() > 0.25) {
        let note = ctx.createOscillator(), noteEnv = ctx.createGain()
        note.type = 'sine'; note.frequency.value = roots[chord] * 2 ** ([12, 15, 17, 19, 22][random() * 5 | 0] / 12)
        noteEnv.gain.setValueAtTime(0, time + beat * 0.2); noteEnv.gain.linearRampToValueAtTime(0.08, time + beat * 0.24)
        noteEnv.gain.exponentialRampToValueAtTime(0.001, time + beat * 0.85)
        note.connect(noteEnv).connect(master); note.start(time + beat * 0.2); safeStop(note, time + beat)
        sources.push(note); nodes.push(note, noteEnv)
      }
    }
  }
  fadeOut(master.gain, when, duration, 0.26)
  return result({ sources, nodes, duration, graph: 'Modal harmony + bass + improvised cells → Destination' })
}

export function buildTremolo(ctx, {
  carrier = 440, rate = 5, depth = 0.55, waveform = 'sine', duration = 4, gain = 0.2,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let voice = ctx.createOscillator(), lfo = ctx.createOscillator(), lfoGain = ctx.createGain()
  let offset = ctx.createConstantSource(), mixer = ctx.createGain(), master = ctx.createGain()
  voice.frequency.value = carrier; lfo.type = waveform; lfo.frequency.value = rate
  lfoGain.gain.value = depth; offset.offset.value = 1 - depth; mixer.gain.value = 0; master.gain.value = gain
  voice.connect(mixer).connect(master).connect(destination); lfo.connect(lfoGain).connect(mixer.gain); offset.connect(mixer.gain)
  voice.start(when); lfo.start(when); offset.start(when); fadeOut(master.gain, when, duration, gain)
  for (let source of [voice, lfo, offset]) safeStop(source, when + duration + 0.01)
  return result({ sources: [voice, lfo, offset], nodes: [voice, lfo, lfoGain, offset, mixer, master], duration, graph: 'LFO + ConstantSource → Gain.gain ← Carrier' })
}

export function buildSpatial(ctx, {
  frequency = 440, duration = 3, gain = 0.22, when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let osc = ctx.createOscillator(), panner = ctx.createPanner(), master = ctx.createGain()
  osc.frequency.value = frequency; panner.panningModel = 'equalpower'; panner.distanceModel = 'inverse'
  panner.positionX.setValueAtTime(-7, when); panner.positionX.linearRampToValueAtTime(7, when + duration)
  panner.positionY.value = 0; panner.positionZ.value = -2; master.gain.value = gain
  osc.connect(panner).connect(master).connect(destination); osc.start(when); fadeOut(master.gain, when, duration, gain)
  safeStop(osc, when + duration + 0.01)
  return result({ sources: [osc], nodes: [osc, panner, master], duration, graph: 'Oscillator → Panner → Gain → Destination' })
}

export function buildLinkedParams(ctx, {
  duration = 2, when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let a = ctx.createOscillator(), b = ctx.createOscillator(), gainA = ctx.createGain(), gainB = ctx.createGain()
  let control = ctx.createConstantSource(), mix = ctx.createGain()
  a.frequency.value = 440; b.frequency.value = 660; gainA.gain.value = 0; gainB.gain.value = 0; mix.gain.value = 0.4
  control.offset.setValueAtTime(0, when); control.offset.linearRampToValueAtTime(0.45, when + duration * 0.25)
  control.offset.setValueAtTime(0.45, when + duration * 0.75); control.offset.linearRampToValueAtTime(0, when + duration)
  control.connect(gainA.gain); control.connect(gainB.gain); a.connect(gainA).connect(mix); b.connect(gainB).connect(mix); mix.connect(destination)
  for (let source of [a, b, control]) { source.start(when); safeStop(source, when + duration + 0.01) }
  return result({ sources: [a, b, control], nodes: [a, b, gainA, gainB, control, mix], duration, graph: 'ConstantSource → 2 Gain AudioParams → mix → Destination' })
}

export function buildTwoTone(ctx, {
  frequencies = [440, 880], duration = 1.5, gain = 0.5, when = ctx.currentTime,
  destination = ctx.destination, analyser = null,
} = {}) {
  let meter = analyser || ctx.createAnalyser(), mix = ctx.createGain(); mix.gain.value = gain
  meter.fftSize = 2048; mix.connect(meter).connect(destination)
  let sources = [], nodes = [mix, meter]
  for (let frequency of frequencies) {
    let osc = ctx.createOscillator(); osc.frequency.value = frequency; osc.connect(mix); osc.start(when); safeStop(osc, when + duration + 0.01)
    sources.push(osc); nodes.push(osc)
  }
  return result({ sources, nodes, duration, graph: '2 Oscillators → Analyser → Destination', data: { analyser: meter } })
}

export function buildProcessedBuffer(ctx, buffer, {
  highShelfFrequency = 4000, highShelfGain = -6, threshold = -20, ratio = 4,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let source = ctx.createBufferSource(), eq = ctx.createBiquadFilter(), compressor = ctx.createDynamicsCompressor()
  source.buffer = buffer; eq.type = 'highshelf'; eq.frequency.value = highShelfFrequency; eq.gain.value = highShelfGain
  compressor.threshold.value = threshold; compressor.ratio.value = ratio
  source.connect(eq).connect(compressor).connect(destination); source.start(when); safeStop(source, when + buffer.duration + 0.01)
  return result({ sources: [source], nodes: [source, eq, compressor], duration: buffer.duration, graph: 'AudioBuffer → high-shelf EQ → compressor → Destination' })
}

export const portableBuilders = {
  tone: buildTone,
  sweep: buildSweep,
  noise: buildNoise,
  impulse: buildImpulse,
  dtmf: buildDtmf,
  'stereo-test': buildStereoTest,
  metronome: buildMetronome,
  shepard: buildShepard,
  'risset-rhythm': buildRissetRhythm,
  'binaural-beats': buildBinaural,
  'missing-fundamental': buildMissingFundamental,
  beating: buildBeating,
  'subtractive-synth': buildSubtractive,
  additive: buildAdditive,
  'fm-synthesis': buildFM,
  'karplus-strong': buildKarplusStrong,
  sequencer: buildSequencer,
  serial: buildSerial,
  gamelan: buildGamelan,
  drone: buildDrone,
  jazz: buildJazz,
  speaker: buildTone,
  lfo: buildTremolo,
  spatial: buildSpatial,
  'linked-params': buildLinkedParams,
  fft: buildTwoTone,
  'render-to-buffer': buildTone,
}

export function buildPortable(id, ctx, options = {}) {
  let build = portableBuilders[id]
  if (!build) throw new Error(`No portable graph is registered for ${id}`)
  return build(ctx, options)
}
