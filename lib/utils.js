var inherits = require('util').inherits
  , _ = require('underscore')
  , AudioBuffer = require('audiobuffer')
  , AV = require('../aurora')

// Simple helper to make defining a read-only attribute less verbose
module.exports.readOnlyAttr = function(obj, name, value) {
  Object.defineProperty(obj, name, {value: value, writable: false})
}

// Helper to decode a buffer of encoded audio data.
// Guesses the format, and decodes to an AudioBuffer accordingly.
module.exports.decodeAudioData = function(buffer, done) {

  var bufSrc = new BufferSource(buffer)
  bufSrc.once('data', function(data) {

    // Select a demuxer class, and instantiate a demuxer
    var Demuxer = AV.Demuxer.find(data)
      , demuxer
    if (Demuxer) demuxer = new Demuxer(bufSrc, data)
    else return done(new Error('audio format not recognized'))

    return demuxer.once('format', function(format) {

      // Select a decoder class and instantiate a decoder
      var frameCount = buffer.length / format.bytesPerPacket 
        , Decoder = AV.Decoder.find(format.formatID)
        , decoder
      if (Decoder) decoder = new Decoder(demuxer, format)
      else return done(new Error('no decoder available for audio format ' + format.formatID))

      // This function will decode the next chunk
      var decodeNext = function() { while (decoder.decode()) continue }
    
      // We will deinterleave the decoded data [<ch1_frame1>, <ch2_frame1>, ..., <chN_frameN>]
      // and put it in `samples` [[<ch1_frame1, <ch1_frame2>, ...], [<ch2_frame1, <ch2_frame2>, ...], ...]
      var numberOfChannels = format.channelsPerFrame
        , samples = []
        , i, ch, pos, length
      for (ch = 0; ch < numberOfChannels; ch++) samples.push(new Float32Array(frameCount))

      // TODO : this works only for signed
      ch = 0
      pos = -1
      pcmMax = Math.pow(2, format.bitsPerChannel - 1)
      decoder.on('data', function(decodedChunk) {
        if (decodedChunk) {
          for (i = 0, length = decodedChunk.length; i < length; i++) {
            if (ch === 0) pos++
            samples[ch][pos] = decodedChunk[i] / pcmMax
            ch = ++ch % numberOfChannels
          }
        }
        decodeNext()
      })

      decoder.on('end', function() {
        samples = samples.map(function(chArray) { return chArray.subarray(0, pos + 1) })
        done(null, AudioBuffer.fromArray(samples, format.sampleRate))
      })

      decodeNext()
    })

  })

  bufSrc.start()
}

// This is a source for working with aurora.js
var BufferSource = function (buffer) {
  this.buffer = buffer
  this.loaded = buffer.length
  this.size = buffer.length
}
inherits(BufferSource, AV.EventEmitter)

_.extend(BufferSource.prototype, {

  start: function() {
    this.emit('progress', 100)
    this.emit('data', new AV.Buffer(new Uint8Array(this.buffer)))
    this.emit('end')
  }
  
})