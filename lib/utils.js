var _ = require('underscore')


module.exports.chainExtend = function() {
  var sources = Array.prototype.slice.call(arguments, 0)
    , parent = this
    , child = function() { parent.apply(this, arguments) }

  // Fix instanceof
  child.prototype = new parent()

  // extend with new properties
  _.extend.apply(this, [child.prototype, parent.prototype].concat(sources))

  child.extend = this.extend
  return child
}

// Simple helper to make defining a read-only attribute less verbose
module.exports.readOnlyAttr = function(obj, name, value) {
  Object.defineProperty(obj, name, {value: value, writable: false})
} 

// Creates and returns a function which decodes node `Buffer`
// to an array of `Float32Array`, each corresponding to one channel.
// `format` configures the decoder, and should contain `bitDepth` and `numberOfChannels`.
// !!! If the data contains some incomplete samples they will be dropped
var PCMDecoder = module.exports.PCMDecoder = function(format) {
  var byteDepth = Math.round(format.bitDepth / 8)
    , numberOfChannels = format.numberOfChannels
    , pcmMax = Math.pow(2, format.bitDepth) / 2 - 1
    , i, ch, chArray, array, frameCount

  return function(data) {
    frameCount = Math.round(data.length / (byteDepth * numberOfChannels))
    array = []

    // Push samples to each channel
    for (ch = 0; ch < numberOfChannels; ch++) {
      chArray = new Float32Array(frameCount)
      array.push(chArray)
      for (i = 0; i < frameCount; i++)
        chArray[i] = data.readInt16LE(byteDepth * (i * numberOfChannels + ch)) / pcmMax
    }
    return array
  }
}

// Creates and returns a function which encodes an array of Float32Array - each of them
// a separate channel - to a node `Buffer`.
// `format` configures the encoder, and should contain `bitDepth` and `numberOfChannels`.
// !!! This does not check that the data received matches the specified 'format'.
var PCMEncoder = module.exports.PCMEncoder = function(format) {
  var byteDepth = Math.round(format.bitDepth / 8)
    , numberOfChannels = format.numberOfChannels
    , pcmMult = Math.pow(2, format.bitDepth) / 2
    , pcmMax = pcmMult - 1
    , pcmMin = -pcmMult
    , i, ch, chArray, buffer, frameCount

  return function(array) {
    frameCount = array[0].length
    buffer = new Buffer(frameCount * byteDepth * numberOfChannels)

    for (ch = 0; ch < numberOfChannels; ch++) {
      chArray = array[ch]
      for (i = 0; i < frameCount; i++)
        buffer.writeInt16LE(Math.round(chArray[i] * pcmMult), byteDepth * (i * numberOfChannels + ch))
    }

    return buffer
  }
}