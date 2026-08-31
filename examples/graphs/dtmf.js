// DTMF dialer: Synthesize telephone keypad tones from paired row and column frequencies.
// CLI: node examples/dtmf.js 5551234
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function safeStop(source, time) {
  try { source.stop(time) } catch { return }
}

const low = { 1:697,2:697,3:697,A:697, 4:770,5:770,6:770,B:770, 7:852,8:852,9:852,C:852, '*':941,0:941,'#':941,D:941 }
const high = { 1:1209,2:1336,3:1477,A:1633, 4:1209,5:1336,6:1477,B:1633, 7:1209,8:1336,9:1477,C:1633, '*':1209,0:1336,'#':1477,D:1633 }

export function schedule(ctx, digit, {
  when = ctx.currentTime, duration = 0.12, gain = 0.15, destination = ctx.destination,
} = {}) {
  if (!low[digit]) return { sources: [], nodes: [], duration: 0, graph: 'Invalid DTMF digit' }
  let sources = [], nodes = []
  for (let frequency of [low[digit], high[digit]]) {
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
  return { sources, nodes, duration, graph: '2 Oscillators → Envelope → Destination' }
}

export function build(ctx, {
  digits = '5551234', speed = 0.13, when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let sources = [], nodes = [], time = when
  for (let digit of digits.toUpperCase()) {
    let voice = schedule(ctx, digit, { when: time, duration: speed, destination })
    sources.push(...voice.sources); nodes.push(...voice.nodes)
    time += speed * 1.7
  }
  return { sources, nodes, duration: Math.max(0.3, time - when), graph: 'DTMF oscillator pairs → envelopes → Destination' }
}
