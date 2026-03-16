import AudioBuffer from 'audio-buffer'
import decode from 'audio-decode'

// polyfill Symbol.dispose
Symbol.dispose ||= Symbol('dispose')

// Decode encoded audio data to AudioBuffer.
// Always returns Promise. Callback form supported for compat.
export async function decodeAudioData(buffer, done) {
  try {
    let { channelData, sampleRate } = await decode(buffer)
    let audioBuffer = AudioBuffer.fromArray(channelData, sampleRate)
    if (done) done(null, audioBuffer)
    return audioBuffer
  } catch (err) {
    if (done) return done(err)
    throw err
  }
}

// DataView write method names for PCM encoding
const WRITE = { 8: 'setInt8', 16: 'setInt16', 32: 'setInt32' }
const WRITE_U = { 8: 'setUint8', 16: 'setUint16', 32: 'setUint32' }

// PCM encoder: converts Float32Array[] (planar channels) to interleaved PCM bytes
// Cross-environment: uses ArrayBuffer + DataView (no Node Buffer dependency)
export function BufferEncoder(format) {
  format = validateFormat(format)
  let { bitDepth, numberOfChannels, endianness, signed } = format
  let byteDepth = bitDepth >> 3
  let le = endianness === 'LE'
  let method = (signed ? WRITE : WRITE_U)[bitDepth]
  let pcmMult = 2 ** (bitDepth - 1)
  let pcmMax = pcmMult - 1
  let pcmMin = signed ? -pcmMult : 0
  let useLE = bitDepth > 8 // 8-bit has no endianness

  return function(array) {
    let frameCount = array[0].length
    let ab = new ArrayBuffer(frameCount * byteDepth * numberOfChannels)
    let view = new DataView(ab)
    for (let ch = 0; ch < numberOfChannels; ch++) {
      let chArray = array[ch]
      for (let i = 0; i < frameCount; i++) {
        let val = Math.max(pcmMin, Math.min(pcmMax, Math.round(chArray[i] * pcmMult)))
        let offset = (i * numberOfChannels + ch) * byteDepth
        useLE ? view[method](offset, val, le) : view[method](offset, val)
      }
    }
    return new Uint8Array(ab)
  }
}

export function validateFormat(format) {
  format = { bitDepth: 16, endianness: 'LE', signed: true, ...format }
  if (typeof format.bitDepth !== 'number' || ![8, 16, 32].includes(format.bitDepth))
    throw new Error('invalid bitDepth')
  if (typeof format.numberOfChannels !== 'number' || format.numberOfChannels < 1)
    throw new Error('invalid numberOfChannels')
  if (!['LE', 'BE'].includes(format.endianness))
    throw new Error('invalid endianness')
  return format
}
