var assert = require('assert')
  , AudioBuffer = require('../lib/AudioBuffer')

describe('AudioBuffer', function() {
  
  var toArray = function(data) {
    return Array.prototype.slice.call(data, 0)
  }

  it('should be created with the right attributes', function() {
    var ab = new AudioBuffer(3, 100, 44100)
      , data1 = ab.getChannelData(0)
      , data2 = ab.getChannelData(1)
      , data3 = ab.getChannelData(2)

    assert.equal(ab.sampleRate, 44100)
    assert.equal(ab.length, 100)
    assert.equal(ab.numberOfChannels, 3)
    toArray(data1).forEach(function(val) { assert.equal(val, 0) })
    toArray(data2).forEach(function(val) { assert.equal(val, 0) })
    toArray(data3).forEach(function(val) { assert.equal(val, 0) })
    assert.equal(data1.length, 100)
    assert.equal(data2.length, 100)
    assert.equal(data3.length, 100)
  })

  it('should throw an error with invalid creation arguments', function() {
    assert.throws(function() { new AudioBuffer('a', 100, 44100) })
    assert.throws(function() { new AudioBuffer(3, -1, 44100) })
    assert.throws(function() { new AudioBuffer(3, 100, 'rr') })
  })

  describe('getChannelData', function() {

    it('should return valid channels', function() {
      var ab = new AudioBuffer(2, 3, 44100)
      assert.equal(ab.getChannelData(0), ab._data[0])
      assert.equal(ab.getChannelData(1), ab._data[1])
    })

    it('should throw an error if the channel is not valid', function() {
      var ab = new AudioBuffer(2, 3, 44100)
      assert.throws(function() { ab.getChannelData(2) })
    })

  })

  describe('filledWithVal', function() {

    it('should return a buffer with the value given', function() {
      var ab = AudioBuffer.filledWithVal(111, 4, 200, 44100)
        , data1 = ab.getChannelData(0)
        , data2 = ab.getChannelData(1)
        , data3 = ab.getChannelData(2)

      assert.equal(ab.sampleRate, 44100)
      assert.equal(ab.length, 200)
      assert.equal(ab.numberOfChannels, 4)
      toArray(data1).forEach(function(val) { assert.equal(val, 111) })
      toArray(data2).forEach(function(val) { assert.equal(val, 111) })
      toArray(data3).forEach(function(val) { assert.equal(val, 111) })
      assert.equal(data1.length, 200)
      assert.equal(data2.length, 200)
      assert.equal(data3.length, 200)
    })

  })

})