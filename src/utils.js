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

// PCM encoder: converts Float32Array[] to interleaved PCM Buffer
export function BufferEncoder(format) {
  format = validateFormat(format)
  let byteDepth = Math.round(format.bitDepth / 8)
  let numberOfChannels = format.numberOfChannels
  let pcmMult = Math.pow(2, format.bitDepth) / 2
  let pcmMax = pcmMult - 1
  let pcmMin = -pcmMult
  let encodeFunc = 'writeInt' + (format.signed ? '' : 'U') + format.bitDepth + format.endianness

  return function(array) {
    let frameCount = array[0].length
    let buffer = Buffer.alloc(frameCount * byteDepth * numberOfChannels)
    for (let ch = 0; ch < numberOfChannels; ch++) {
      let chArray = array[ch]
      for (let i = 0; i < frameCount; i++)
        buffer[encodeFunc](
          Math.max(Math.min(Math.round(chArray[i] * pcmMult), pcmMax), pcmMin),
          byteDepth * (i * numberOfChannels + ch)
        )
    }
    return buffer
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
