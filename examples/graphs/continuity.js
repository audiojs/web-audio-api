// Continuity illusion: Punch gaps in a steady tone and fill them with louder noise bursts so the tone sounds unbroken.
// CLI: node examples/continuity.js 440 0.6 on 15s
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function seeded(seed = 0x434f4e54) {
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

// Equal-power fade shape, sampled into a curve for setValueCurveAtTime: cos/sin quarter-waves
// keep tone+noise power roughly constant through the crossfade, so nothing dips or clicks.
function equalPowerCurve(peak, steps, rising) {
  let curve = new Float32Array(steps)
  for (let i = 0; i < steps; i++) {
    let x = i / (steps - 1)
    curve[i] = peak * Math.sin((rising ? x : 1 - x) * Math.PI / 2)
  }
  return curve
}

export function init(ctx, {
  frequency = 440, gaprate = 0.6, noise = 'on', duration = 15, gain = 0.06, seed = 0x434f4e54,
  when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let random = seeded(seed)
  let period = 1 / gaprate, gapDuration = Math.min(0.09, period * 0.35)
  let attack = 0.008
  let xfade = Math.min(0.012, gapDuration / 4) // crossfade half-width straddles each gap edge
  // A Q=4.3 bandpass passes noise power roughly proportional to its Hz bandwidth (∝ sqrt(frequency)
  // for constant Q), so the envelope needs frequency compensation to land the masking noise at a
  // consistent ~13.5 dB over the tone across the whole frequency range, not just at one pitch.
  let noiseGain = gain * 1600 / Math.sqrt(Math.max(50, frequency))

  let osc = ctx.createOscillator(), toneGain = ctx.createGain()
  osc.frequency.value = frequency; toneGain.gain.value = 0
  osc.connect(toneGain).connect(destination)
  toneGain.gain.setValueAtTime(0, when)
  toneGain.gain.linearRampToValueAtTime(gain, when + attack)
  osc.start(when); safeStop(osc, when + duration + 0.02)
  let sources = [osc], nodes = [osc, toneGain]

  // Third-octave bandpass around the tone: narrow enough that the masking noise reads as
  // belonging to the same pitch region, not broadband hiss (Q ≈ 4.3 for ~1/3 octave bandwidth).
  let noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.5), ctx.sampleRate)
  let noiseData = noiseBuffer.getChannelData(0)
  for (let i = 0; i < noiseData.length; i++) noiseData[i] = random() * 2 - 1

  let t = when + period
  while (t < when + duration) {
    let gapStart = t, gapEnd = t + gapDuration

    // Gap-entry crossfade straddles gapStart: the tone is still fading out as the noise fades
    // in, so there is never an instant of silence between the tone edge and the noise onset.
    toneGain.gain.setValueCurveAtTime(equalPowerCurve(gain, 12, false), gapStart - xfade, xfade * 2)
    // Gap-exit crossfade straddles gapEnd, mirrored: noise fades out as the tone returns.
    toneGain.gain.setValueCurveAtTime(equalPowerCurve(gain, 12, true), gapEnd - xfade, xfade * 2)

    if (noise === 'on') {
      let burst = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), env = ctx.createGain()
      burst.buffer = noiseBuffer; filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = 4.3
      env.gain.setValueCurveAtTime(equalPowerCurve(noiseGain, 12, true), gapStart - xfade, xfade * 2)
      env.gain.setValueCurveAtTime(equalPowerCurve(noiseGain, 12, false), gapEnd - xfade, xfade * 2)
      burst.connect(filter).connect(env).connect(destination)
      burst.start(gapStart - xfade, random() * Math.max(0, noiseBuffer.duration - gapDuration))
      safeStop(burst, gapEnd + xfade + 0.01)
      sources.push(burst); nodes.push(burst, filter, env)
    }
    t += period
  }
  return { sources, nodes, duration, graph: 'Oscillator (equal-power gapped Gain) + band-matched noise bursts → Destination' }
}
