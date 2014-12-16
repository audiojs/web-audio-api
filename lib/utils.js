var AudioBuffer = require('./AudioBuffer')
  , AV = require('av')
  , mp3 = require('mp3')
  , flac = require('flac')
  , alac = require('alac')
  , aac = require('aac')


// Simple helper to make defining a read-only attribute less verbose
module.exports.readOnlyAttr = function(obj, name, value) {
  Object.defineProperty(obj, name, {
    value: value,
    writable: false
  })
}

// Helper to decode a buffer of encoded audio data.
// Guesses the format, and decodes to an AudioBuffer accordingly.
module.exports.decodeAudioData = function(buffer, done) {
  var asset = AV.Asset.fromBuffer(buffer)

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
}
