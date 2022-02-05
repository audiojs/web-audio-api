import AudioBuffer from './AudioBuffer.js'
import AV from 'av'
import mp3 from 'mp3'
import flac from 'flac'
import alac from 'alac'
import aac from 'aac'


export {
  readOnlyAttr,
  decodeAudioData
}

// Simple helper to make defining a read-only attribute less verbose
function readOnlyAttr (obj, name, value) {
  Object.defineProperty(obj, name, {
    value: value,
    writable: false
  })
}

// Helper to decode a buffer of encoded audio data.
// Guesses the format, and decodes to an AudioBuffer accordingly.
function decodeAudioData (buffer, done) {
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
