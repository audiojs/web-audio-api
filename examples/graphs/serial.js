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

export function init(ctx, {
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
  return { sources, nodes, duration, graph: 'Twelve-tone row → scheduled voices → Destination', data: { row } }
}
