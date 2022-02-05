import assert from 'assert'
import _ from 'underscore'
import AudioBuffer from '../src/AudioBuffer.js'

describe('AudioBuffer.js', function() {
  it('should be created with the right attributes', function() {
    var ab = new AudioBuffer(3, 100, 44100)
      , data1 = ab.getChannelData(0)
      , data2 = ab.getChannelData(1)
      , data3 = ab.getChannelData(2)

    assert.equal(ab.sampleRate, 44100)
    assert.equal(ab.length, 100)
    assert.equal(ab.numberOfChannels, 3)
    _.toArray(data1).forEach(function(val) { assert.equal(val, 0) })
    _.toArray(data2).forEach(function(val) { assert.equal(val, 0) })
    _.toArray(data3).forEach(function(val) { assert.equal(val, 0) })
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
      _.toArray(data1).forEach(function(val) { assert.equal(val, 111) })
      _.toArray(data2).forEach(function(val) { assert.equal(val, 111) })
      _.toArray(data3).forEach(function(val) { assert.equal(val, 111) })
      assert.equal(data1.length, 200)
      assert.equal(data2.length, 200)
      assert.equal(data3.length, 200)
    })

  })

  describe('fromArray', function() {

    it('should create an AudioBuffer from an array of arrays', function() {
      var array = [
        [1, 2, 3, 4],
        [11, 22, 33, 44],
        [111, 222, 333, 444]
      ]
      var ab = AudioBuffer.fromArray(array, 44100)
      assert.equal(ab.numberOfChannels, 3)
      assert.equal(ab.sampleRate, 44100)
      assert.equal(ab.length, 4)
      for (var i = 0; i < 3; i++)
        assert.ok(ab.getChannelData(i) instanceof Float32Array)
      assert.deepEqual(_.toArray(ab.getChannelData(0)), [1, 2, 3, 4])
      assert.deepEqual(_.toArray(ab.getChannelData(1)), [11, 22, 33, 44])
      assert.deepEqual(_.toArray(ab.getChannelData(2)), [111, 222, 333, 444])
    })

    it('should create an AudioBuffer from an array of Float32Array', function() {
      var array = [
        new Float32Array([1, 2, 3, 4]),
        new Float32Array([11, 22, 33, 44]),
        new Float32Array([111, 222, 333, 444])
      ]
      var ab = AudioBuffer.fromArray(array, 44100)
      assert.equal(ab.numberOfChannels, 3)
      assert.equal(ab.sampleRate, 44100)
      assert.equal(ab.length, 4)
      for (var i = 0; i < 3; i++)
        assert.ok(ab.getChannelData(i) instanceof Float32Array)
      assert.deepEqual(_.toArray(ab.getChannelData(0)), [1, 2, 3, 4])
      assert.deepEqual(_.toArray(ab.getChannelData(1)), [11, 22, 33, 44])
      assert.deepEqual(_.toArray(ab.getChannelData(2)), [111, 222, 333, 444])
    })

  })

  describe('slice', function() {
    it('should slice properly all channels', function() {
      var sliced
        , ab = AudioBuffer.fromArray([
          [1, 2, 3, 4, 5],
          [11, 22, 33, 44, 55],
          [111, 222, 333, 444, 555]
        ], 22050),
        slice

      slice = ab.slice(0)
      assert.equal(slice.length, 5)
      assert.equal(slice.numberOfChannels, 3)
      assert.equal(slice.sampleRate, 22050)
      assert.deepEqual(_.toArray(slice.getChannelData(0)), [1, 2, 3, 4, 5])
      assert.deepEqual(_.toArray(slice.getChannelData(1)), [11, 22, 33, 44, 55])
      assert.deepEqual(_.toArray(slice.getChannelData(2)), [111, 222, 333, 444, 555])

      slice = ab.slice(3)
      assert.equal(slice.length, 2)
      assert.equal(slice.numberOfChannels, 3)
      assert.equal(slice.sampleRate, 22050)
      assert.deepEqual(_.toArray(slice.getChannelData(0)), [4, 5])
      assert.deepEqual(_.toArray(slice.getChannelData(1)), [44, 55])
      assert.deepEqual(_.toArray(slice.getChannelData(2)), [444, 555])

      slice = ab.slice(1, 3)
      assert.equal(slice.length, 2)
      assert.equal(slice.numberOfChannels, 3)
      assert.equal(slice.sampleRate, 22050)
      assert.deepEqual(_.toArray(slice.getChannelData(0)), [2, 3])
      assert.deepEqual(_.toArray(slice.getChannelData(1)), [22, 33])
      assert.deepEqual(_.toArray(slice.getChannelData(2)), [222, 333])
    })

    it('should return the whole slice even of the slice end is to big', function() {
      var sliced
        , ab = AudioBuffer.fromArray([
          [1, 2, 3, 4, 5],
          [11, 22, 33, 44, 55],
          [111, 222, 333, 444, 555]
        ], 22050),
        slice

      slice = ab.slice(3, 10)
      assert.equal(slice.length, 2)
      assert.equal(slice.numberOfChannels, 3)
      assert.equal(slice.sampleRate, 22050)
      assert.deepEqual(_.toArray(slice.getChannelData(0)), [4, 5])
      assert.deepEqual(_.toArray(slice.getChannelData(1)), [44, 55])
      assert.deepEqual(_.toArray(slice.getChannelData(2)), [444, 555])
    })

  })

  describe('concat', function() {

    it('should concatenate 2 AudioBuffers with same sampleRate and numberOfChannels', function() {
      var ab1 = AudioBuffer.fromArray([
          [1, 2, 3, 4, 5],
          [11, 22, 33, 44, 55],
          [111, 222, 333, 444, 555]
        ], 22050)
        , ab2 = AudioBuffer.fromArray([
          [6, 7],
          [66, 77],
          [666, 777]
        ], 22050)
        , newAb
      newAb = ab1.concat(ab2)
      assert.equal(newAb.length, 7)
      assert.equal(newAb.numberOfChannels, 3)
      assert.equal(newAb.sampleRate, 22050)
      assert.deepEqual(_.toArray(newAb.getChannelData(0)), [1, 2, 3, 4, 5, 6, 7])
      assert.deepEqual(_.toArray(newAb.getChannelData(1)), [11, 22, 33, 44, 55, 66, 77])
      assert.deepEqual(_.toArray(newAb.getChannelData(2)), [111, 222, 333, 444, 555, 666, 777])
    })

    it('should throw an error if the AudioBuffers to concatenate are incompatible', function() {
      var ab1 = AudioBuffer.fromArray([
          [1, 2, 3, 4, 5],
          [11, 22, 33, 44, 55],
          [111, 222, 333, 444, 555]
        ], 22050)
        , ab2 = AudioBuffer.fromArray([
          [6, 7],
          [66, 77],
          [666, 777]
        ], 44100)
      assert.throws(function() { ab1.concat(ab2) })

      ab1 = AudioBuffer.fromArray([
        [1, 2, 3, 4, 5],
        [11, 22, 33, 44, 55],
      ], 22050)
      ab2 = AudioBuffer.fromArray([
        [6, 7],
        [66, 77],
        [666, 777]
      ], 22050)
      assert.throws(function() { ab1.concat(ab2) })
    })

  })

  describe('set', function() {

    it('should set audio buffer data, channel by channel', function() {
      var audioBuffer1 = AudioBuffer.fromArray([
          [1, 2, 3, 4, 5],
          [11, 22, 33, 44, 55],
        ], 22050)
        , audioBuffer2 = AudioBuffer.fromArray([
          [6, 7],
          [66, 77],
        ], 22050)

      audioBuffer1.set(audioBuffer2)
      assert.deepEqual(_.toArray(audioBuffer1.getChannelData(0)), [6, 7, 3, 4, 5])
      assert.deepEqual(_.toArray(audioBuffer1.getChannelData(1)), [66, 77, 33, 44, 55])
    })

    it('should set audio buffer data, taking offset into account', function() {
      var audioBuffer1 = AudioBuffer.fromArray([
          [1, 2, 3, 4, 5],
          [11, 22, 33, 44, 55],
        ], 22050)
        , audioBuffer2 = AudioBuffer.fromArray([
          [6, 7],
          [66, 77],
        ], 22050)

      audioBuffer1.set(audioBuffer2, 2)
      assert.deepEqual(_.toArray(audioBuffer1.getChannelData(0)), [1, 2, 6, 7, 5])
      assert.deepEqual(_.toArray(audioBuffer1.getChannelData(1)), [11, 22, 66, 77, 55])
    })

    it('should throw an error if the AudioBuffers to set are incompatible', function() {
      var ab1, ab2
      ab1 = AudioBuffer.fromArray([
        [1, 2, 3, 4, 5],
        [11, 22, 33, 44, 55],
        [111, 222, 333, 444, 555]
      ], 22050)
      ab2 = AudioBuffer.fromArray([
        [6, 7],
        [66, 77],
        [666, 777]
      ], 44100)
      assert.throws(function() { ab1.set(ab2) })

      ab1 = AudioBuffer.fromArray([
        [1, 2, 3, 4, 5],
        [11, 22, 33, 44, 55],
      ], 22050)
      ab2 = AudioBuffer.fromArray([
        [6, 7],
        [66, 77],
        [666, 777]
      ], 22050)
      assert.throws(function() { ab1.set(ab2) })

      ab1 = AudioBuffer.fromArray([
        [1, 2, 3, 4, 5],
        [11, 22, 33, 44, 55],
      ], 22050)
      ab2 = AudioBuffer.fromArray([
        [6, 7, 8, 9, 10, 11],
        [66, 77, 88, 99, 1010, 1111]
      ], 22050)
      assert.throws(function() { ab1.set(ab2) })
    })

  })

})
