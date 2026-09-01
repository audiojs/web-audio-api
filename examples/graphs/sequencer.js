// Step sequencer: Schedule a 16-step melody against the audio clock.
// CLI: npx web-audio-api sequencer bpm=140 -d 10s
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function safeStop(source, time) {
  try { source.stop(time) } catch { return }
}

function noteToFrequency(token) {
  let match = token.match(/^([A-G])([#b])?(-?\d)$/i)
  if (!match) return 0
  let semitone = 'C.D.EF.G.A.B'.indexOf(match[1].toUpperCase()) + (match[2] === '#') - (match[2] === 'b')
  return 440 * 2 ** ((semitone + 12 * (+match[3] + 1) - 69) / 12)
}

export function init(ctx, {
  bpm = 140, pattern = null, duration = null, loops = 1, when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let notes = pattern
    ? pattern.split(',').map(token => noteToFrequency(token.trim()))
    : [440, 0, 523.25, 0, 587.33, 0, 659.25, 0, 587.33, 523.25, 440, 0, 329.63, 0, 440, 0]
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
  return { sources, nodes, duration: totalDuration, graph: '16-step audio-clock scheduler → envelopes → Destination' }
}
