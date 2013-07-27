var assert = require('assert')
  , async = require('async')
  , AudioBuffer = require('audiobuffer')
  , AudioBufferSourceNode = require('../lib/AudioBufferSourceNode')
  , BLOCK_SIZE = require('../lib/constants').BLOCK_SIZE

describe('AudioBufferSourceNode', function() {

  // Helper to get a test buffer
  //  0.1 ... 128 times ...  0.2 ... 128 times ...  0.3 ... 128 times ...  0.4 ... 128 times ...  0.5 ... 64 times
  // -0.1 ... 128 times ... -0.2 ... 128 times ... -0.3 ... 128 times ... -0.4 ... 128 times ... -0.5 ... 64 times 
  var getTestBuffer = function() {
    var audioBuffer = new AudioBuffer(2, 128 * 4 + 64, 44100)
      , chArray, i, j
    // Filling in the audio buffer
    for (i = 0; i < 4; i++) {
      chArray = audioBuffer.getChannelData(0)
      for (j = 0; j < 128; j++)
        chArray[i * BLOCK_SIZE + j] = (i + 1) * 0.1
      chArray = audioBuffer.getChannelData(1)
      for (j = 0; j < 128; j++)
        chArray[i * BLOCK_SIZE + j] = (i + 1) * -0.1
    }
    chArray = audioBuffer.getChannelData(0)
    for (j = 0; j < 64; j++)
      chArray[4 * BLOCK_SIZE + j] = 0.5
    chArray = audioBuffer.getChannelData(1)
    for (j = 0; j < 64; j++)
      chArray[4 * BLOCK_SIZE + j] = -0.5
    return audioBuffer
  }

  describe('_tick', function() {
    
    var helpers = require('./helpers')()
      , dummyContext

    beforeEach(function() {
      dummyContext = {sampleRate: 44100, currentTime: 0, BLOCK_SIZE: BLOCK_SIZE}
    })

    it('should pull zeros when reading not started', function() {
      var node = new AudioBufferSourceNode(dummyContext)
        , block
      while(dummyContext.currentTime < 2) {
        dummyContext.currentTime++
        block = node._tick()
        assert.equal(block.length, 128)
        assert.equal(block.numberOfChannels, 1)
        helpers.assertAllValuesEqual(block.getChannelData(0), 0)
      }
    })

    it('should pull the audio from the buffer', function() {
      var node = new AudioBufferSourceNode(dummyContext)
        , blocks = []
        , audioBuffer = getTestBuffer()
      node.buffer = audioBuffer
      node.start(1)

      // Runs _tick for a while, saving the returned blocks
      while(dummyContext.currentTime < 7) {
        blocks.push(node._tick())
        dummyContext.currentTime += 1
      }

      // Before playback is started
      assert.equal(blocks[0].numberOfChannels, 1)
      assert.equal(blocks[0].length, 128)
      helpers.assertAllValuesEqual(blocks[0].getChannelData(0), 0)

      // Full blocks read
      blocks.slice(1, 4).forEach(function(audioBuffer, i) {
        assert.equal(audioBuffer.numberOfChannels, 2)
        assert.equal(audioBuffer.length, 128)
      })
      helpers.assertAllValuesApprox(blocks[1].getChannelData(0), 0.1)
      helpers.assertAllValuesApprox(blocks[1].getChannelData(1), -0.1)
      helpers.assertAllValuesApprox(blocks[2].getChannelData(0), 0.2)
      helpers.assertAllValuesApprox(blocks[2].getChannelData(1), -0.2)
      helpers.assertAllValuesApprox(blocks[3].getChannelData(0), 0.3)
      helpers.assertAllValuesApprox(blocks[3].getChannelData(1), -0.3)
      helpers.assertAllValuesApprox(blocks[4].getChannelData(0), 0.4)
      helpers.assertAllValuesApprox(blocks[4].getChannelData(1), -0.4)

      // Incomplete block read
      assert.equal(blocks[5].numberOfChannels, 2)
      assert.equal(blocks[5].length, 128)
      helpers.assertAllValuesApprox(blocks[5].getChannelData(0).slice(0, 63), 0.5)
      helpers.assertAllValuesApprox(blocks[5].getChannelData(0).slice(64, 128), 0)
      helpers.assertAllValuesApprox(blocks[5].getChannelData(1).slice(0, 63), -0.5)
      helpers.assertAllValuesApprox(blocks[5].getChannelData(1).slice(64, 128), 0)

      // Playback over
      assert.equal(blocks[6].numberOfChannels, 1)
      assert.equal(blocks[6].length, 128)
      helpers.assertAllValuesEqual(blocks[6].getChannelData(0), 0)
    })

    it('should loop the audio from the buffer', function() {
      var node = new AudioBufferSourceNode(dummyContext)
        , blocks = []
        , audioBuffer = getTestBuffer()
      node.buffer = audioBuffer
      node.loop = true
      node.start(0)

      // Runs _tick for a while, saving the returned blocks
      while(dummyContext.currentTime < 7) {
        dummyContext.currentTime += 1
        blocks.push(node._tick())
      }

      blocks.forEach(function(audioBuffer) {
        assert.equal(audioBuffer.length, 128)
        assert.equal(audioBuffer.numberOfChannels, 2)
      })
      // Full blocks read
      helpers.assertAllValuesApprox(blocks[0].getChannelData(0), 0.1)
      helpers.assertAllValuesApprox(blocks[0].getChannelData(1), -0.1)
      helpers.assertAllValuesApprox(blocks[1].getChannelData(0), 0.2)
      helpers.assertAllValuesApprox(blocks[1].getChannelData(1), -0.2)
      helpers.assertAllValuesApprox(blocks[2].getChannelData(0), 0.3)
      helpers.assertAllValuesApprox(blocks[2].getChannelData(1), -0.3)
      helpers.assertAllValuesApprox(blocks[3].getChannelData(0), 0.4)
      helpers.assertAllValuesApprox(blocks[3].getChannelData(1), -0.4)

      // Incomplete blocks read
      helpers.assertAllValuesApprox(blocks[4].getChannelData(0).slice(0, 63), 0.5)
      helpers.assertAllValuesApprox(blocks[4].getChannelData(1).slice(0, 63), -0.5)
      helpers.assertAllValuesApprox(blocks[4].getChannelData(0).slice(64, 128), 0.1)
      helpers.assertAllValuesApprox(blocks[4].getChannelData(1).slice(64, 128), -0.1)

      helpers.assertAllValuesApprox(blocks[5].getChannelData(0).slice(0, 63), 0.1)
      helpers.assertAllValuesApprox(blocks[5].getChannelData(1).slice(0, 63), -0.1)
      helpers.assertAllValuesApprox(blocks[5].getChannelData(0).slice(64, 128), 0.2)
      helpers.assertAllValuesApprox(blocks[5].getChannelData(1).slice(64, 128), -0.2)

      helpers.assertAllValuesApprox(blocks[6].getChannelData(0).slice(0, 63), 0.2)
      helpers.assertAllValuesApprox(blocks[6].getChannelData(1).slice(0, 63), -0.2)
      helpers.assertAllValuesApprox(blocks[6].getChannelData(0).slice(64, 128), 0.3)
      helpers.assertAllValuesApprox(blocks[6].getChannelData(1).slice(64, 128), -0.3)
    })

    it('should loop the audio from offset to offset + duration', function() {
      var node = new AudioBufferSourceNode(dummyContext)
        , blocks = []
        , audioBuffer = getTestBuffer()
      node.buffer = audioBuffer
      node.loop = true
      // 0.1 ... X64 ... 0.2 ... X128 ....
      node.start(0, 64 / 44100, 64 * 3 / 44100)

      // Runs _tick for a while, saving the returned blocks
      while(dummyContext.currentTime < 10) {
        dummyContext.currentTime += 1
        blocks.push(node._tick())
      }

      blocks.forEach(function(audioBuffer) {
        assert.equal(audioBuffer.length, 128)
        assert.equal(audioBuffer.numberOfChannels, 2)
      })

      // The loop is 1.5 blocks, so the offset loop/block resolves every 3 blocks
      for (var i = 0; i < 3; i++) {
        helpers.assertAllValuesApprox(blocks[i * 3 + 0].getChannelData(0).slice(0, 63), 0.1)
        helpers.assertAllValuesApprox(blocks[i * 3 + 0].getChannelData(1).slice(0, 63), -0.1)
        helpers.assertAllValuesApprox(blocks[i * 3 + 0].getChannelData(0).slice(64, 128), 0.2)
        helpers.assertAllValuesApprox(blocks[i * 3 + 0].getChannelData(1).slice(64, 128), -0.2)

        helpers.assertAllValuesApprox(blocks[i * 3 + 1].getChannelData(0).slice(0, 63), 0.2)
        helpers.assertAllValuesApprox(blocks[i * 3 + 1].getChannelData(1).slice(0, 63), -0.2)
        helpers.assertAllValuesApprox(blocks[i * 3 + 1].getChannelData(0).slice(64, 128), 0.1)
        helpers.assertAllValuesApprox(blocks[i * 3 + 1].getChannelData(1).slice(64, 128), -0.1)

        helpers.assertAllValuesApprox(blocks[i * 3 + 2].getChannelData(0).slice(0, 63), 0.2)
        helpers.assertAllValuesApprox(blocks[i * 3 + 2].getChannelData(1).slice(0, 63), -0.2)
        helpers.assertAllValuesApprox(blocks[i * 3 + 2].getChannelData(0).slice(64, 128), 0.2)
        helpers.assertAllValuesApprox(blocks[i * 3 + 2].getChannelData(1).slice(64, 128), -0.2)
      }
    })

    it('should loop the audio from loopStart to loopEnd', function() {
      var node = new AudioBufferSourceNode(dummyContext)
        , blocks = []
        , audioBuffer = getTestBuffer()
      node.buffer = audioBuffer
      node.loop = true
      // 0.1 ... X64 ... 0.2 ... X128 ....
      node.loopStart = 64 / 44100
      node.loopEnd = 64 * 4 / 44100
      node.start(0)

      // Runs _tick for a while, saving the returned blocks
      while(dummyContext.currentTime < 9) {
        dummyContext.currentTime += 1
        blocks.push(node._tick())
      }

      blocks.forEach(function(audioBuffer) {
        assert.equal(audioBuffer.length, 128)
        assert.equal(audioBuffer.numberOfChannels, 2)
      })

      // The loop is 1.5 blocks, so the offset loop/block resolves every 3 blocks
      for (var i = 0; i < 3; i++) {
        helpers.assertAllValuesApprox(blocks[i * 3 + 0].getChannelData(0).slice(0, 63), 0.1)
        helpers.assertAllValuesApprox(blocks[i * 3 + 0].getChannelData(1).slice(0, 63), -0.1)
        helpers.assertAllValuesApprox(blocks[i * 3 + 0].getChannelData(0).slice(64, 128), 0.2)
        helpers.assertAllValuesApprox(blocks[i * 3 + 0].getChannelData(1).slice(64, 128), -0.2)

        helpers.assertAllValuesApprox(blocks[i * 3 + 1].getChannelData(0).slice(0, 63), 0.2)
        helpers.assertAllValuesApprox(blocks[i * 3 + 1].getChannelData(1).slice(0, 63), -0.2)
        helpers.assertAllValuesApprox(blocks[i * 3 + 1].getChannelData(0).slice(64, 128), 0.1)
        helpers.assertAllValuesApprox(blocks[i * 3 + 1].getChannelData(1).slice(64, 128), -0.1)

        helpers.assertAllValuesApprox(blocks[i * 3 + 2].getChannelData(0).slice(0, 63), 0.2)
        helpers.assertAllValuesApprox(blocks[i * 3 + 2].getChannelData(1).slice(0, 63), -0.2)
        helpers.assertAllValuesApprox(blocks[i * 3 + 2].getChannelData(0).slice(64, 128), 0.2)
        helpers.assertAllValuesApprox(blocks[i * 3 + 2].getChannelData(1).slice(64, 128), -0.2)
      }
    })

  })

  describe('stop', function() {

    var helpers = require('./helpers')()
      , dummyContext

    beforeEach(function() {
      dummyContext = {sampleRate: 44100, currentTime: 0, BLOCK_SIZE: 128}
    })

    it('should stop the playing', function() {
      var node = new AudioBufferSourceNode(dummyContext)
        , audioBuffer = getTestBuffer()
        , block

      node.buffer = audioBuffer
      node.loop = true
      // 0.1 ... X64 ... 0.2 ... X128 ....
      node.start(0)
      node.stop(1)

      block = node._tick()
      assert.equal(block.length, 128)
      assert.equal(block.numberOfChannels, 2)
      helpers.assertAllValuesApprox(block.getChannelData(0), 0.1)
      helpers.assertAllValuesApprox(block.getChannelData(1), -0.1)

      dummyContext.currentTime += 1
      block = node._tick()
      assert.equal(block.length, 128)
      assert.equal(block.numberOfChannels, 1)
      helpers.assertAllValuesEqual(block.getChannelData(0), 0)
    })

  })

})