import AudioBuffer from './AudioBuffer.js'
import AV from 'av'
import mp3 from 'mp3'
import flac from 'flac'
import alac from 'alac'
import aac from 'aac'
import assert from 'assert'
import fs from 'fs'


// Simple helper to make defining a read-only attribute less verbose
export function readOnlyAttr (obj, name, value) {
  Object.defineProperty(obj, name, {
    value: value,
    writable: false
  })
}

// Helper to decode a buffer of encoded audio data.
// Guesses the format, and decodes to an AudioBuffer accordingly.
export function decodeAudioData (buffer, done) {
  var asset = AV.Asset.fromBuffer(buffer)

  // Pseudo overload
  if (arguments.length > 1) {
    // Callback
    asset.on('error', function(err) {
      done(err)
    })

    asset.decodeToBuffer(function(decoded) {
      var deinterleaved = []
        , numberOfChannels = asset.format.channelsPerFrame
        , length = Math.floor(decoded.length / numberOfChannels)
        , ch, chArray, i

      for (ch = 0; ch < numberOfChannels; ch++)
        deinterleaved.push(new Float32Array(length))

      for (ch = 0; ch < numberOfChannels; ch++) {
        chArray = deinterleaved[ch]
        for (i = 0; i < length; i++)
          chArray[i] = decoded[ch + i * numberOfChannels]
      }

      done(null, AudioBuffer.fromArray(deinterleaved, asset.format.sampleRate))
    })
  } else {
    // Promise
    return new Promise(function(resolve, reject) {
      asset.on('error', function(err) {
        reject(err)
      })

      asset.decodeToBuffer(function(decoded) {
        var deinterleaved = []
          , numberOfChannels = asset.format.channelsPerFrame
          , length = Math.floor(decoded.length / numberOfChannels)
          , ch, chArray, i

        for (ch = 0; ch < numberOfChannels; ch++)
          deinterleaved.push(new Float32Array(length))

        for (ch = 0; ch < numberOfChannels; ch++) {
          chArray = deinterleaved[ch]
          for (i = 0; i < length; i++)
            chArray[i] = decoded[ch + i * numberOfChannels]
        }

        resolve(AudioBuffer.fromArray(deinterleaved, asset.format.sampleRate))
      })
    })
  }
}

// stripped out pcm-boilerplate/BufferEncoder
// Creates and returns a function which encodes an array of Float32Array - each of them
// a separate channel - to a node `Buffer`.
// `format` configures the encoder, and should contain `bitDepth` and `numberOfChannels`.
// !!! This does not check that the data received matches the specified 'format'.
// TODO : format.signed, pcmMax is different if unsigned
export function BufferEncoder(format) {
  format = validateFormat(format)
  var byteDepth = Math.round(format.bitDepth / 8)
    , numberOfChannels = format.numberOfChannels
    , pcmMult = Math.pow(2, format.bitDepth) / 2
    , pcmMax = pcmMult - 1
    , pcmMin = -pcmMult
    , encodeFunc = 'writeInt' + (format.signed ? '' : 'U') + format.bitDepth + format.endianness
    , i, ch, chArray, buffer, frameCount

  return function(array) {
    frameCount = array[0].length
    buffer = new Buffer(frameCount * byteDepth * numberOfChannels)
    for (ch = 0; ch < numberOfChannels; ch++) {
      chArray = array[ch]
      for (i = 0; i < frameCount; i++)
        buffer[encodeFunc](
          Math.max(Math.min(Math.round(chArray[i] * pcmMult), pcmMax), pcmMin),
          byteDepth * (i * numberOfChannels + ch)
        )
    }
    return buffer
  }
}
export function validateFormat(format) {
  format = Object.assign({
    bitDepth: 16,
    endianness: 'LE',
    signed: true
  }, format)

  assert(typeof format.bitDepth === 'number')
  assert([8, 16, 32].includes(format.bitDepth))
  assert(typeof format.numberOfChannels === 'number')
  assert(format.numberOfChannels > 0)
  assert(typeof format.endianness === 'string')
  assert(['LE', 'BE'].includes(format.endianness))
  assert(typeof format.signed === 'boolean')

  return format
}

export function loadWasm(path) {
  const buffer = fs.readFileSync('./dsp/gain.wasm')
  const mod = new WebAssembly.Module(buffer)
  const instance = new WebAssembly.Instance(mod)
  return instance
}
