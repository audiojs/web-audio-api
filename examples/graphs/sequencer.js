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

// Each step plays a small subtractive voice: two saws a few cents apart over a square an
// octave down, through a resonant low-pass whose cutoff falls with the note. A dotted-eighth
// echo, darkened in its feedback loop, sits to one side.
export function init(ctx, {
  bpm = 140, pattern = null, duration = null, loops = 1, when = ctx.currentTime, destination = ctx.destination,
} = {}) {
  let notes = pattern
    ? pattern.split(',').map(token => noteToFrequency(token.trim()))
    : [440, 0, 523.25, 0, 587.33, 0, 659.25, 0, 587.33, 523.25, 440, 0, 329.63, 0, 440, 0]
  let step = 60 / bpm / 4, sources = [], nodes = []
  let totalDuration = duration ?? notes.length * loops * step
  let end = when + totalDuration

  let master = ctx.createGain(); master.gain.value = 0.9
  master.connect(destination)
  let voiceBus = ctx.createGain()
  voiceBus.connect(master)
  let echo = ctx.createDelay(2), feedback = ctx.createGain(), darken = ctx.createBiquadFilter(), echoLevel = ctx.createGain(), echoPan = ctx.createStereoPanner()
  echo.delayTime.value = Math.min(1.99, step * 3)
  feedback.gain.value = 0.36
  darken.type = 'lowpass'; darken.frequency.value = 3200
  echoLevel.gain.value = 0.28; echoPan.pan.value = 0.55
  voiceBus.connect(echo).connect(darken).connect(feedback).connect(echo)
  darken.connect(echoLevel).connect(echoPan).connect(master)
  nodes.push(master, voiceBus, echo, feedback, darken, echoLevel, echoPan)

  let play = (frequency, time) => {
    let gate = Math.min(time + step * 0.88, end)
    let filter = ctx.createBiquadFilter(), amp = ctx.createGain()
    filter.type = 'lowpass'; filter.Q.value = 5
    filter.frequency.setValueAtTime(Math.min(ctx.sampleRate * 0.4, frequency * 9), time)
    filter.frequency.exponentialRampToValueAtTime(frequency * 1.6, gate)
    amp.gain.setValueAtTime(0, time)
    amp.gain.linearRampToValueAtTime(0.16, time + 0.003)
    amp.gain.exponentialRampToValueAtTime(0.001, gate)
    filter.connect(amp).connect(voiceBus)
    nodes.push(filter, amp)
    let last
    for (let [ratio, cents, type, level] of [[1, -6, 'sawtooth', 0.5], [1, 6, 'sawtooth', 0.5], [0.5, 0, 'square', 0.3]]) {
      let osc = last = ctx.createOscillator(), gain = ctx.createGain()
      osc.type = type; osc.frequency.value = frequency * ratio; osc.detune.value = cents
      gain.gain.value = level
      osc.connect(gain).connect(filter)
      osc.start(time); safeStop(osc, gate + 0.01)
      sources.push(osc); nodes.push(osc, gain)
    }
    last.onended = () => amp.disconnect()
  }

  let loopCount = Math.ceil(totalDuration / (notes.length * step))
  for (let loop = 0; loop < loopCount; loop++) for (let i = 0; i < notes.length; i++) {
    if (!notes[i]) continue
    let time = when + (loop * notes.length + i) * step
    if (time >= end) continue
    play(notes[i], time)
  }
  return { sources, nodes, duration: totalDuration, graph: '16-step audio-clock scheduler → envelopes → Destination' }
}
