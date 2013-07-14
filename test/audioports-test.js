var assert = require('assert')
  , _ = require('underscore')
  , utils = require('../lib/utils')
  , audioports = require('../lib/audioports')
  , AudioOutput = audioports.AudioOutput
  , AudioInput = audioports.AudioInput
  , AudioBuffer = require('../lib/AudioBuffer')
  , BLOCK_SIZE = require('../lib/constants').BLOCK_SIZE
  , assertAllValuesApprox = require('./helpers').assertAllValuesApprox


describe('AudioPort', function() {

  var dummyNode = {}
    , received = []
    , setupInputHandlers = function(audioInput) {
      audioInput.on('connection', function(source) {
        received.push(['audioInput connection', audioInput.id, source.id])
      })

      audioInput.on('disconnection', function(source) {
        received.push(['audioInput disconnection', audioInput.id, source.id])
      })
    }
    , setupOutputHandlers = function(audioOutput) {
      audioOutput.on('connection', function(sink) {
        received.push(['audioOutput connection', audioOutput.id, sink.id])
      })

      audioOutput.on('disconnection', function(sink) {
        received.push(['audioOutput disconnection', audioOutput.id, sink.id])
      })
    }

  beforeEach(function() {
    received = []
  })

  describe('connect/disconnect', function() {

    it('should connect/disconnect properly', function() {
      var sink = new AudioInput(dummyNode, 0)
        , source = new AudioOutput(dummyNode, 1)

      sink.connect(source)
      assert.deepEqual(sink.sources, [source])
      sink.disconnect(source)
      assert.deepEqual(sink.sources, [])
    })

    it('should emit the right events when connecting/disconnecting', function() {
      var sink = new AudioInput(dummyNode, 0)
        , source = new AudioOutput(dummyNode, 1)
      setupInputHandlers(sink)
      setupOutputHandlers(source)

      sink.connect(source)
      assert.deepEqual(received, [
        ['audioOutput connection', 1, 0],
        ['audioInput connection', 0, 1]
      ])

      source.disconnect(sink)
      assert.deepEqual(received, [
        ['audioOutput connection', 1, 0],
        ['audioInput connection', 0, 1],
        ['audioInput disconnection', 0, 1],
        ['audioOutput disconnection', 1, 0]
      ])
    })

  })

})

describe('AudioInput', function() {

  describe('computedNumberOfChannels', function() {

    it('should get max when channelCountMode is max', function() {
      var dummyNode1 = {channelCount: 6, channelCountMode: 'max'}
        , dummyNode2 = {channelCount: 3}
        , dummyNode3 = {channelCount: 1}
        , input1 = new AudioInput(dummyNode1, 0)
        , output1 = new AudioOutput(dummyNode2, 0)
        , output2 = new AudioOutput(dummyNode3, 0)

      input1.connect(output2)
      assert.equal(input1.computedNumberOfChannels, 1)
      input1.connect(output1)
      assert.equal(input1.computedNumberOfChannels, 3)
      input1.disconnect(output2)
      assert.equal(input1.computedNumberOfChannels, 3)
    })

    it('should get max and clamp when channelCountMode is clamped-max', function() {
      var dummyNode1 = {channelCount: 4, channelCountMode: 'clamped-max'}
        , dummyNode2 = {channelCount: 6}
        , dummyNode3 = {channelCount: 1}
        , input1 = new AudioInput(dummyNode1, 0)
        , output1 = new AudioOutput(dummyNode2, 0)
        , output2 = new AudioOutput(dummyNode3, 0)

      input1.connect(output2)
      assert.equal(input1.computedNumberOfChannels, 1)
      input1.connect(output1)
      assert.equal(input1.computedNumberOfChannels, 4)
      input1.disconnect(output2)
      assert.equal(input1.computedNumberOfChannels, 4)
    })

    it('should get channelCount when channelCountMode is explicit', function() {
      var dummyNode1 = {channelCount: 5, channelCountMode: 'explicit'}
        , dummyNode2 = {channelCount: 6}
        , dummyNode3 = {channelCount: 1}
        , input1 = new AudioInput(dummyNode1, 0)
        , output1 = new AudioOutput(dummyNode2, 0)
        , output2 = new AudioOutput(dummyNode3, 0)

      input1.connect(output2)
      assert.equal(input1.computedNumberOfChannels, 5)
      input1.connect(output1)
      assert.equal(input1.computedNumberOfChannels, 5)
    })

    it('should throw an error if there\'s no connection', function() {
      var dummyNode1 = {channelCount: 3, channelCountMode: 'max'}
        , input1 = new AudioInput(dummyNode1, 0)
      assert.throws(function() { input1.computedNumberOfChannels })
    })

  })

  describe('tick', function() {

    it('should up-mix by adding zeros in discrete mode', function() {
      var sinkNode = {channelCount: 5, channelCountMode: 'explicit', channelInterpretation: 'discrete'}
        , sourceNode1 = {channelCount: 3}
        , sourceNode2 = {channelCount: 1}
        , input = new AudioInput(sinkNode, 0)
        , output1 = new AudioOutput(sourceNode1, 0)
        , output2 = new AudioOutput(sourceNode2, 0)
        , outBuff
      output1.buffer = new AudioBuffer.filledWithVal(0.1, 44100, 3, BLOCK_SIZE)
      output2.buffer = new AudioBuffer.filledWithVal(0.2, 44100, 1, BLOCK_SIZE)

      input.connect(output2)
      assert.equal(input.computedNumberOfChannels, 5)

      outBuff = AudioBuffer.zeros(44100, 5, BLOCK_SIZE)
      input.tick(outBuff)
      assertAllValuesApprox(outBuff.getChannelData(0), 0.2)
      assertAllValuesApprox(outBuff.getChannelData(1), 0)
      assertAllValuesApprox(outBuff.getChannelData(2), 0)
      assertAllValuesApprox(outBuff.getChannelData(3), 0)
      assertAllValuesApprox(outBuff.getChannelData(4), 0)

      input.connect(output1)
      outBuff = AudioBuffer.zeros(44100, 5, BLOCK_SIZE)
      input.tick(outBuff)
      assertAllValuesApprox(outBuff.getChannelData(0), 0.15)
      assertAllValuesApprox(outBuff.getChannelData(1), 0.05)
      assertAllValuesApprox(outBuff.getChannelData(2), 0.05)
      assertAllValuesApprox(outBuff.getChannelData(3), 0)
      assertAllValuesApprox(outBuff.getChannelData(4), 0)
    })

    it('should down-mix by dropping channels in discrete mode', function() {
      var sinkNode = {channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'discrete'}
        , sourceNode1 = {channelCount: 4}
        , sourceNode2 = {channelCount: 1}
        , input = new AudioInput(sinkNode, 0)
        , output1 = new AudioOutput(sourceNode1, 0)
        , output2 = new AudioOutput(sourceNode2, 0)
        , outBuff

      output1.buffer = new AudioBuffer.filledWithVal(0.1, 44100, 4, BLOCK_SIZE)
      output2.buffer = new AudioBuffer.filledWithVal(0.2, 44100, 1, BLOCK_SIZE)

      input.connect(output2)
      assert.equal(input.computedNumberOfChannels, 2)

      outBuff = AudioBuffer.zeros(44100, 2, BLOCK_SIZE)
      input.tick(outBuff)
      assertAllValuesApprox(outBuff.getChannelData(0), 0.2)
      assertAllValuesApprox(outBuff.getChannelData(1), 0)

      input.connect(output1)
      outBuff = AudioBuffer.zeros(44100, 2, BLOCK_SIZE)
      input.tick(outBuff)
      assertAllValuesApprox(outBuff.getChannelData(0), 0.15)
      assertAllValuesApprox(outBuff.getChannelData(1), 0.05)
    })

  })

})