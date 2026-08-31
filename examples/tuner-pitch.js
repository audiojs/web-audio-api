// Pitch detection and temporal stabilization for the tuner.
// Kept separate from tuner.js so the DSP can be tested without opening audio devices.

import yin from '@audio/pitch-yin'

export function detectPitch(samples, sampleRate, { minFreq = 60, maxFreq = 520, minRms = 0.001 } = {}) {
  let sum = 0, sumSquares = 0
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i]
    sumSquares += samples[i] * samples[i]
  }
  let mean = sum / samples.length
  let rms = Math.sqrt(Math.max(0, sumSquares / samples.length - mean * mean))
  if (rms < minRms) return null

  let pitch = yin(samples, { fs: sampleRate, threshold: 0.15, minFreq, maxFreq })
  if (!pitch || !Number.isFinite(pitch.freq) || pitch.freq < minFreq || pitch.freq > maxFreq) return null
  return pitch
}

// A tuner must not relabel the note on one bad frame. Acquire a note twice, then
// require three consecutive frames before switching to another note or octave.
export function createPitchTracker({ acquireAfter = 2, switchAfter = 3, smoothing = 0.35 } = {}) {
  let midi = null, pendingMidi = null, pendingHits = 0, frequency = null
  let clearPending = () => { pendingMidi = null; pendingHits = 0 }
  let reset = () => { midi = frequency = null; clearPending() }

  return {
    update(pitch, a4 = 440) {
      let next = typeof pitch === 'number' ? pitch : pitch?.freq
      if (!Number.isFinite(next) || next <= 0) { clearPending(); return null }
      let nextMidi = Math.round(69 + 12 * Math.log2(next / a4))

      if (nextMidi === midi) {
        clearPending()
        frequency *= (next / frequency) ** smoothing
        return frequency
      }

      if (nextMidi === pendingMidi) pendingHits++
      else { pendingMidi = nextMidi; pendingHits = 1 }

      let needed = midi === null ? acquireAfter : switchAfter
      if (pendingHits < needed) return null

      midi = nextMidi
      frequency = next
      clearPending()
      return frequency
    },
    reset,
  }
}
