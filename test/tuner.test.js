import test, { almost, is, ok } from 'tst'
import { detectPitch, createPitchTracker } from '../examples/tuner-pitch.js'

let sampleRate = 44100
let frame = (frequency, amplitudes = [1], length = 4096) => {
  let samples = new Float32Array(length)
  for (let i = 0; i < samples.length; i++)
    for (let h = 1; h <= amplitudes.length; h++)
      samples[i] += amplitudes[h - 1] * Math.sin(2 * Math.PI * frequency * h * i / sampleRate)
  return samples
}

let changingOvertones = frequency => {
  let samples = new Float32Array(4096)
  for (let i = 128; i < samples.length; i++) {
    let amplitudes = i < 512 ? [0.005, 0.4, 0.001] : [0.05, 0.2, 0.02]
    for (let h = 1; h <= amplitudes.length; h++)
      samples[i] += amplitudes[h - 1] * Math.exp(-2 * i / sampleRate) * Math.sin(2 * Math.PI * frequency * h * i / sampleRate)
  }
  return samples
}

test('tuner detector keeps the fundamental as overtone balance changes', () => {
  let pitch = detectPitch(changingOvertones(82.41), sampleRate)
  ok(pitch)
  almost(pitch.freq, 82.41, 0.5)
})

test('tuner detector hears a quiet low E2', () => {
  let pitch = detectPitch(frame(80.91, [0.002], 8192), sampleRate)
  ok(pitch)
  almost(pitch.freq, 80.91, 0.5)
})

test('tuner detector rejects silence and pitches outside its range', () => {
  is(detectPitch(new Float32Array(8192), sampleRate), null)
  is(detectPitch(frame(880), sampleRate), null)
})

test('tuner tracker ignores isolated note and octave errors', () => {
  let tracker = createPitchTracker()
  is(tracker.update(110), null)
  almost(tracker.update(110), 110, 1e-9)

  is(tracker.update(220), null)
  almost(tracker.update(110), 110, 1e-9)
  is(tracker.update(116.54), null)
  almost(tracker.update(110), 110, 1e-9)
})

test('tuner tracker confirms a real note change before switching', () => {
  let tracker = createPitchTracker()
  tracker.update(110)
  tracker.update(110)

  is(tracker.update(146.83), null)
  is(tracker.update(146.83), null)
  almost(tracker.update(146.83), 146.83, 1e-9)
})
