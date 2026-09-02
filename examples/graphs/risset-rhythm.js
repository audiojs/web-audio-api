// Risset rhythm: Layer tempo cycles to create a beat that appears to accelerate or decelerate forever.
// CLI: npx web-audio-api risset-rhythm up 120 20s
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function seeded(seed = 0x52495353) {
  let state = seed >>> 0
  return () => {
    state += 0x6D2B79F5
    let n = state
    n = Math.imul(n ^ n >>> 15, n | 1)
    n ^= n + Math.imul(n ^ n >>> 7, n | 61)
    return ((n ^ n >>> 14) >>> 0) / 4294967296
  }
}

// The rhythmic twin of the Shepard tone. Three click layers sit an octave apart in tempo, the
// way Shepard partials sit an octave apart in pitch. A new layer enters every `doubling`
// seconds at the slow edge of a three-octave tempo window (the fast edge when going down),
// crosses it under a raised-cosine loudness window, and leaves at the other edge. The
// windows are staggered by a third of the cycle, so their sum is constant: no seam, no pump.
//
// The layers never drift apart: each entering layer takes its beat count from the layer
// before it (half of it going up, twice it going down), so a faster layer always subdivides
// a slower one. Every beat then has a closed form, and the beats that also fall on the
// slower layer are accented, which is what makes the tempo octave audible.
const layers = 3
const doubling = 6 // seconds per tempo doubling; a layer crosses the window in layers * doubling

// Built-in click: a contact tick and a short damped mode, the accent pitched a little higher
function createClick(ctx, { destination, random, sources, nodes }) {
  let noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.25), ctx.sampleRate)
  let noise = noiseBuffer.getChannelData(0)
  for (let i = 0; i < noise.length; i++) noise[i] = random() * 2 - 1
  let master = ctx.createGain()
  master.gain.value = 0.7
  master.connect(destination)
  nodes.push(master)
  return (when, mark, level = 1) => {
    if (mark === '-' || mark === '.') return
    let strong = mark === 'X'
    let body = ctx.createGain()
    body.gain.setValueAtTime(0, when)
    body.gain.linearRampToValueAtTime((strong ? 0.32 : 0.2) * level, when + 0.0005)
    body.gain.exponentialRampToValueAtTime(0.0003, when + (strong ? 0.04 : 0.028))
    body.connect(master)
    for (let [ratio, amount] of [[1, 1], [1.58, 0.3]]) {
      let osc = ctx.createOscillator(), partial = ctx.createGain()
      osc.frequency.value = (strong ? 1900 : 1250) * ratio
      partial.gain.value = amount
      osc.connect(partial).connect(body)
      osc.start(when); osc.stop(when + 0.05)
      sources.push(osc); nodes.push(osc, partial)
      if (ratio === 1) osc.onended = () => body.disconnect()
    }
    let burst = ctx.createBufferSource(), tick = ctx.createBiquadFilter(), envelope = ctx.createGain()
    burst.buffer = noiseBuffer
    tick.type = 'highpass'; tick.frequency.value = 3000
    envelope.gain.setValueAtTime(0, when)
    envelope.gain.linearRampToValueAtTime((strong ? 0.2 : 0.13) * level, when + 0.0003)
    envelope.gain.exponentialRampToValueAtTime(0.0005, when + 0.004)
    burst.connect(tick).connect(envelope).connect(master)
    burst.start(when, random() * 0.2); burst.stop(when + 0.004)
    burst.onended = () => envelope.disconnect()
    sources.push(burst); nodes.push(burst, tick, envelope, body)
  }
}

export function init(ctx, {
  direction = 'up', bpm = 120, duration = 20, hit = null, seed = 0x52495353,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let up = direction !== 'down'
  let random = seeded(seed)
  let sources = [], nodes = [], beats = []
  hit ||= createClick(ctx, { destination, random, sources, nodes })

  let period = layers * doubling
  let edge = (up ? bpm / 2 ** (layers / 2) : bpm * 2 ** (layers / 2)) / 60 // beats per second where a layer enters
  // beats a layer has played `seconds` into its window: the integral of its tempo
  let count = seconds => edge * doubling / Math.LN2 * (up ? 2 ** (seconds / doubling) - 1 : 1 - 2 ** (-seconds / doubling))
  // ...and the inverse: when the layer's `n`-th beat falls
  let at = n => doubling * (up ? Math.log2(1 + n * Math.LN2 / (edge * doubling)) : -Math.log2(1 - n * Math.LN2 / (edge * doubling)))

  // Layers enter every `doubling` seconds; the three inside the window at t = 0 entered at
  // -2, -1, and 0 doublings. `phase` is the fractional beat count a layer carries in from its
  // predecessor, which is what keeps the grids nested.
  let open = [], nextEntry = 1 - layers, phase = 0
  let admit = () => {
    open.push({ start: when + nextEntry * doubling, phase, n: Math.ceil(phase), layer: ((nextEntry % layers) + layers) % layers })
    let carried = phase + count(doubling)
    phase = up ? (carried / 2) % 1 : (carried * 2) % 1
    nextEntry++
  }
  let scheduleUntil = horizon => {
    horizon = Math.min(horizon, when + duration)
    while (when + nextEntry * doubling < horizon) admit()
    for (let voice of open) {
      for (;;) {
        let time = voice.start + at(voice.n - voice.phase)
        if (!(time < horizon)) break
        let window = (time - voice.start) / period
        if (window >= 1) { voice.n = Infinity; break }
        let level = 0.5 - 0.5 * Math.cos(2 * Math.PI * window)
        if (time >= when && level > 0.02) {
          let strong = voice.n % 2 === 0
          hit(time, strong ? 'X' : 'x', level)
          beats.push({ time: time - when, layer: voice.layer, strong, level })
        }
        voice.n++
      }
    }
    open = open.filter(voice => voice.n !== Infinity)
  }
  // Offline contexts render faster than wall clock, so every beat is scheduled upfront;
  // live contexts get a rolling lookahead window, keeping the node count bounded however
  // long the run is
  if (typeof ctx.startRendering === 'function') scheduleUntil(when + duration)
  else {
    let lookahead = 4
    scheduleUntil(ctx.currentTime + lookahead)
    let timer = setInterval(() => {
      if (ctx.state !== 'running' || ctx.currentTime >= when + duration) return clearInterval(timer)
      scheduleUntil(ctx.currentTime + lookahead)
    }, 500)
  }
  return { sources, nodes, duration, graph: 'Octave-spaced tempo layers → windowed clicks → Destination', data: { beats } }
}
