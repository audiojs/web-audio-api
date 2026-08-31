// Generative gamelan: Schedule interlocking slendro patterns with metalophone partials and gong structure.
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function safeStop(source, time) {
  try { source.stop(time) } catch { return }
}

export function build(ctx, {
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
  return { sources, nodes, duration, graph: 'Slendro scheduler → metallic partials → Destination' }
}
