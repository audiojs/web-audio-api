import decode from 'audio-decode'
import { from as audioBufferFrom } from 'audio-buffer/util'

// polyfill Symbol.dispose
Symbol.dispose ||= Symbol('dispose')

// Decode encoded audio data to AudioBuffer.
// Always returns Promise. Callback form supported for compat.
export async function decodeAudioData(buffer, done) {
  try {
    let { channelData, sampleRate } = await decode(buffer)
    let audioBuffer = audioBufferFrom(channelData, { sampleRate })
    if (done) done(null, audioBuffer)
    return audioBuffer
  } catch (err) {
    if (done) return done(err)
    throw err
  }
}

