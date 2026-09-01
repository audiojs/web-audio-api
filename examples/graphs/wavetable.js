// Wavetable synth: Build custom Fourier wavetables and crossfade between two oscillators holding different timbres.
// CLI: npx web-audio-api wavetable organ 220 0.3 6s
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function buildTable(name, n = 24) {
  let real = new Float32Array(n), imag = new Float32Array(n)
  if (name === 'bell') {
    for (let [k, amp] of [[1, 1], [3, 0.55], [5, 0.32], [7, 0.2]]) imag[k] = amp
    for (let [k, amp] of [[2, 0.65], [4, 0.42], [6, 0.24]]) real[k] = amp
  } else if (name === 'pulse') {
    let duty = 0.25
    for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty)
  } else if (name === 'voice') {
    let formant = 6
    for (let k = 1; k < n; k++) imag[k] = (1 / k) * (0.25 + 0.75 * Math.exp(-0.5 * ((k - formant) / 1.6) ** 2))
  } else { // organ
    for (let [k, amp] of [[1, 1], [2, 0.55], [3, 0.25], [4, 0.22], [6, 0.14], [8, 0.09]]) imag[k] = amp
  }
  return { real, imag }
}

function fadeOut(param, when, duration, value) {
  let end = when + duration
  let start = Math.max(when, end - Math.min(0.08, duration / 4))
  param.setValueAtTime(value, start)
  param.linearRampToValueAtTime(0, end)
}

function safeStop(source, time) {
  try { source.stop(time) } catch { return }
}

export function init(ctx, {
  preset = 'organ', frequency = 220, morph = 0.3, duration = 6, gain = 0.2,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let order = ['organ', 'bell', 'pulse', 'voice']
  let index = Math.max(0, order.indexOf(preset))
  let next = order[(index + 1) % order.length]
  let tableA = buildTable(order[index]), tableB = buildTable(next)
  let waveA = ctx.createPeriodicWave(tableA.real, tableA.imag)
  let waveB = ctx.createPeriodicWave(tableB.real, tableB.imag)
  let oscA = ctx.createOscillator(), oscB = ctx.createOscillator()
  oscA.setPeriodicWave(waveA); oscB.setPeriodicWave(waveB)
  oscA.frequency.value = frequency; oscB.frequency.value = frequency
  let gainA = ctx.createGain(), gainB = ctx.createGain(), master = ctx.createGain()
  gainA.gain.value = 1 - morph; gainB.gain.value = morph
  master.gain.value = gain
  oscA.connect(gainA).connect(master); oscB.connect(gainB).connect(master); master.connect(destination)
  oscA.start(when); oscB.start(when)
  fadeOut(master.gain, when, duration, gain)
  safeStop(oscA, when + duration + 0.01); safeStop(oscB, when + duration + 0.01)
  return { sources: [oscA, oscB], nodes: [oscA, oscB, gainA, gainB, master], duration, graph: '2 PeriodicWave Oscillators → crossfade Gain → Destination' }
}
