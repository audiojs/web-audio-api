var _ = require('underscore')
  , assert = require('assert')
  , ScriptProcessorNode = require('../build/ScriptProcessorNode')
  , AudioNode = require('../build/AudioNode')
  , AudioBuffer = require('../build/AudioBuffer')
  , BLOCK_SIZE = require('../build/constants').BLOCK_SIZE

describe('ScriptProcessorNode', function() {

  it('should accept valid bufferSize', function() {
    // valid : 256, 512, 1024, 2048, 4096, 8192, 16384
    var dummyContext = {sampleRate: 44100, currentTime: 0, BLOCK_SIZE: BLOCK_SIZE}
      , node
    node = new ScriptProcessorNode(dummyContext, 256, 1, 1)
    node = new ScriptProcessorNode(dummyContext, 512, 1, 1)
    node = new ScriptProcessorNode(dummyContext, 1024, 1, 1)
    node = new ScriptProcessorNode(dummyContext, 2048, 1, 1)
    node = new ScriptProcessorNode(dummyContext, 4096, 1, 1)
    node = new ScriptProcessorNode(dummyContext, 8192, 1, 1)
    node = new ScriptProcessorNode(dummyContext, 16384, 1, 1)
  })

  it('should throw an error with invalid bufferSize', function() {
    var dummyContext = {sampleRate: 44100, currentTime: 0, BLOCK_SIZE: BLOCK_SIZE}
    assert.throws(function() { new ScriptProcessorNode(dummyContext, 255, 1, 1) })
    assert.throws(function() { new ScriptProcessorNode(dummyContext, 'qq', 1, 1) })
    assert.throws(function() { new ScriptProcessorNode(dummyContext, null, 1, 1) })
    assert.throws(function() { new ScriptProcessorNode(dummyContext, '1024', 1, 1) })
  })

  describe('onaudioprocess', function() {

    var helpers = require('./helpers')()
      , dummyContext

    beforeEach(function() {
      dummyContext = {sampleRate: 44100, currentTime: 0, BLOCK_SIZE: BLOCK_SIZE}
    })

    it('should create AudioProcessingEvent with the right lengths and channels', function() {
      var node = new ScriptProcessorNode(dummyContext, 256, 1, 1)
        , count = 0

      node.onaudioprocess = function(event) {
        assert.equal(event.playbackTime, 0)
        assert.equal(event.inputBuffer.length, 256)
        assert.equal(event.inputBuffer.numberOfChannels, 1)
        assert.equal(event.outputBuffer.numberOfChannels, 1)
        count++
      }
      node._tick()
      node._tick()

      dummyContext.currentTime = 2.22
      node = new ScriptProcessorNode(dummyContext, 512, 3, 5)
      node.onaudioprocess = function(event) {
        assert.equal(event.playbackTime, 2.22)
        assert.equal(event.inputBuffer.length, 512)
        assert.equal(event.inputBuffer.numberOfChannels, 3)
        assert.equal(event.outputBuffer.numberOfChannels, 5)
        count++
      }
      node._tick()
      node._tick()
      node._tick()
      node._tick()

      assert.equal(count, 2)
    })

  })

  describe('_tick', function() {

    var helpers = require('./helpers')()
      , dummyContext

    beforeEach(function() {
      dummyContext = {sampleRate: 44100, currentTime: 0, BLOCK_SIZE: BLOCK_SIZE}
    })

    it('should return 0 when no onaudioprocess', function() {
      var node = new ScriptProcessorNode(dummyContext, 512, 1, 2)
        , audioBuffer
      audioBuffer = node._tick()
      assert.equal(audioBuffer.length, BLOCK_SIZE)
      assert.equal(audioBuffer.numberOfChannels, 2)
      helpers.assertAllValuesEqual(audioBuffer.getChannelData(0), 0)
      helpers.assertAllValuesEqual(audioBuffer.getChannelData(1), 0)

      audioBuffer = node._tick()
      assert.equal(audioBuffer.length, BLOCK_SIZE)
      assert.equal(audioBuffer.numberOfChannels, 2)
      helpers.assertAllValuesEqual(audioBuffer.getChannelData(0), 0)
      helpers.assertAllValuesEqual(audioBuffer.getChannelData(1), 0)
    })

    it('should return the processed audio when there is a onaudioprocess handler', function() {
      var scriptNode = new ScriptProcessorNode(dummyContext, 512, 2, 1)
        , sourceNode = new AudioNode(dummyContext, 0, 3)
        , sourceCounter = 0, scriptCounter = 0
        , audioBuffer

      sourceNode._tick = function() {
        sourceCounter++
        var i, ch, length, data = [], chData
        for (ch = 0; ch < 3; ch++) {
          chData = []
          for (i = 0; i < BLOCK_SIZE; i++) chData[i] = sourceCounter + ch
          data.push(chData)
        }
        return new AudioBuffer.fromArray(data, 44100)
      }
      sourceNode.connect(scriptNode)

      // zeros before onaudioprocess attached
      audioBuffer = scriptNode._tick()
      assert.equal(audioBuffer.numberOfChannels, 1)
      helpers.assertAllValuesEqual(audioBuffer.getChannelData(0), 0)

      // Attach a onaudioprocess just summing the 2 input channels
      scriptNode.onaudioprocess = function(event) {
        var dataIn1, dataIn2, dataOut, i, length
        assert.equal(event.inputBuffer.numberOfChannels, 2)
        assert.equal(event.inputBuffer.length, 512)

        dataIn1 = event.inputBuffer.getChannelData(0)
        dataIn2 = event.inputBuffer.getChannelData(1)
        dataOut = event.outputBuffer.getChannelData(0)
        for (i = 0; i < 512; i++) dataOut[i] = dataIn1[i] + dataIn2[i]
        scriptCounter++
      }

      // Run dsp
      assert.equal(scriptCounter, 0)
      _(3).times(function() {
        dummyContext.currentTime++
        audioBuffer = scriptNode._tick()
        assert.equal(audioBuffer.length, BLOCK_SIZE)
        assert.equal(audioBuffer.numberOfChannels, 1)
        helpers.assertAllValuesEqual(audioBuffer.getChannelData(0), 0)
      })
      assert.equal(sourceCounter, 3)
      assert.equal(scriptCounter, 0)

      dummyContext.currentTime++
      audioBuffer = scriptNode._tick()
      assert.equal(sourceCounter, 4)
      assert.equal(scriptCounter, 1)
      assert.equal(audioBuffer.length, BLOCK_SIZE)
      assert.equal(audioBuffer.numberOfChannels, 1)
      helpers.assertAllValuesEqual(audioBuffer.getChannelData(0), 3)

      dummyContext.currentTime++
      audioBuffer = scriptNode._tick()
      assert.equal(sourceCounter, 5)
      assert.equal(scriptCounter, 1)
      assert.equal(audioBuffer.length, BLOCK_SIZE)
      assert.equal(audioBuffer.numberOfChannels, 1)
      helpers.assertAllValuesEqual(audioBuffer.getChannelData(0), 5)

      dummyContext.currentTime++
      audioBuffer = scriptNode._tick()
      assert.equal(sourceCounter, 6)
      assert.equal(scriptCounter, 1)
      assert.equal(audioBuffer.length, BLOCK_SIZE)
      assert.equal(audioBuffer.numberOfChannels, 1)
      helpers.assertAllValuesEqual(audioBuffer.getChannelData(0), 7)

      dummyContext.currentTime++
      audioBuffer = scriptNode._tick()
      assert.equal(sourceCounter, 7)
      assert.equal(scriptCounter, 1)
      assert.equal(audioBuffer.length, BLOCK_SIZE)
      assert.equal(audioBuffer.numberOfChannels, 1)
      helpers.assertAllValuesEqual(audioBuffer.getChannelData(0), 9)

      dummyContext.currentTime++
      audioBuffer = scriptNode._tick()
      assert.equal(sourceCounter, 8)
      assert.equal(scriptCounter, 2)
      assert.equal(audioBuffer.length, BLOCK_SIZE)
      assert.equal(audioBuffer.numberOfChannels, 1)
      helpers.assertAllValuesEqual(audioBuffer.getChannelData(0), 11)
    })

  })

})
