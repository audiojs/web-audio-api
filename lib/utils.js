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

// !!! If the data contains some incomplete samples they will be dropped
var PCMDecoder = module.exports.PCMDecoder = function(format) {
  var byteDepth = Math.round(format.bitDepth / 8)
    , channels = format.channels
    , pcmMax = Math.pow(2, format.bitDepth) / 2 - 1

  return function(data) {
    var sampCount = Math.round(data.length / byteDepth)
      , i = 0, ch = 0
      , array = []
      , value

    // initialize array
    for (; ch < channels; ch++)
      array.push([])

    // Push samples to it
    for (; i < sampCount; i+=channels)
      for (ch = 0; ch < channels; ch++) {
        array[ch].push(data.readInt16LE((i + ch) * byteDepth) / pcmMax)
      }
    return array
  }
}

// This does not check that the data received matches the specified 'format'.
// If there is several channels, make sure that all the channel arrays have the same length.
var PCMEncoder = module.exports.PCMEncoder = function(format) {
  var byteDepth = Math.round(format.bitDepth / 8)
    , channels = format.channels
    , pcmMult = Math.pow(2, format.bitDepth) / 2
    , pcmMax = pcmMult - 1
    , pcmMin = -pcmMult

  return function(array) {
    var buffer = new Buffer(array[0].length * byteDepth * channels)
    array.forEach(function(chArray, ch) {
      chArray.forEach(function(val, i) {
        buffer.writeInt16LE(Math.round(val * pcmMult), byteDepth * (i * channels + ch))
      })
    })
    return buffer
  }
}