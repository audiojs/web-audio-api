var assert = require('assert')
  , _ = require('underscore')
  , utils = require('../lib/utils')
  , audioports = require('../lib/audioports')
  , AudioOutput = audioports.AudioOutput
  , AudioInput = audioports.AudioInput
  , AudioBuffer = require('audiobuffer')
  , BLOCK_SIZE = require('../lib/constants').BLOCK_SIZE
  , assertAllValuesApprox = require('./helpers').assertAllValuesApprox


describe('AudioPort', function() {

  var dummyNode = {}
    , dummyContext = {sampleRate: 44100}
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
      var sink = new AudioInput(dummyContext, dummyNode, 0)
        , source = new AudioOutput(dummyContext, dummyNode, 1)

      sink.connect(source)
      assert.deepEqual(sink.sources, [source])
      sink.disconnect(source)
      assert.deepEqual(sink.sources, [])
    })

    it('should emit the right events when connecting/disconnecting', function() {
      var sink = new AudioInput(dummyContext, dummyNode, 0)
        , source = new AudioOutput(dummyContext, dummyNode, 1)
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

    it('should listen to _numberOfChannels event', function() {
      var sink = new AudioInput(dummyContext, dummyNode, 0)
        , source = new AudioOutput(dummyContext, dummyNode, 1)
      sink.computedNumberOfChannels = 2

      source.emit('_numberOfChannels')
      assert.equal(sink.computedNumberOfChannels, 2)

      source.connect(sink)
      source.emit('_numberOfChannels')
      assert.equal(sink.computedNumberOfChannels, null)
      sink.computedNumberOfChannels = 2

      source.disconnect(sink)
      source.emit('_numberOfChannels')
      assert.equal(sink.computedNumberOfChannels, 2)
    })

  })

})

describe('AudioInput', function() {

  var dummyContext = {sampleRate: 44100}

  describe('_computeNumberOfChannels', function() {

    it('should get max when channelCountMode is max', function() {
      var dummyNode = {channelCount: 6, channelCountMode: 'max'}
        , input = new AudioInput(dummyContext, dummyNode, 0)
      input._computeNumberOfChannels(13)
      assert.equal(input.computedNumberOfChannels, 13)
      input._computeNumberOfChannels(2)
      assert.equal(input.computedNumberOfChannels, 2)
    })

    it('should get max and clamp when channelCountMode is clamped-max', function() {
      var dummyNode = {channelCount: 4, channelCountMode: 'clamped-max'}
        , input = new AudioInput(dummyContext, dummyNode, 0)

      input._computeNumberOfChannels(1)
      assert.equal(input.computedNumberOfChannels, 1)
      input._computeNumberOfChannels(4)
      assert.equal(input.computedNumberOfChannels, 4)
      input._computeNumberOfChannels(6)
      assert.equal(input.computedNumberOfChannels, 4)
    })

    it('should get channelCount when channelCountMode is explicit', function() {
      var dummyNode = {channelCount: 5, channelCountMode: 'explicit'}
        , input = new AudioInput(dummyContext, dummyNode, 0)
      input._computeNumberOfChannels(15)
      assert.equal(input.computedNumberOfChannels, 5)
      input._computeNumberOfChannels(1)
      assert.equal(input.computedNumberOfChannels, 5)
    })

  })

  describe('_tick', function() {

    it('should up-mix by adding zeros in discrete mode', function() {
      var sinkNode = {channelCount: 5, channelCountMode: 'explicit', channelInterpretation: 'discrete'}
        , sourceNode1 = {channelCount: 3}
        , sourceNode2 = {channelCount: 1}
        , input = new AudioInput(dummyContext, sinkNode, 0)
        , output1 = new AudioOutput(dummyContext, sourceNode1, 0)
        , output2 = new AudioOutput(dummyContext, sourceNode2, 0)
        , outBuff

      output1._tick = function() {
        return AudioBuffer.filledWithVal(0.1, 3, BLOCK_SIZE, 44100)
      }
      output2._tick = function() {
        return AudioBuffer.filledWithVal(0.2, 1, BLOCK_SIZE, 44100)
      }

      input.connect(output2)
      outBuff = input._tick()
      assert.equal(input.computedNumberOfChannels, 5)
      assert.equal(outBuff.numberOfChannels, 5)
      assert.equal(outBuff.length, BLOCK_SIZE)

      assertAllValuesApprox(outBuff.getChannelData(0), 0.2)
      assertAllValuesApprox(outBuff.getChannelData(1), 0)
      assertAllValuesApprox(outBuff.getChannelData(2), 0)
      assertAllValuesApprox(outBuff.getChannelData(3), 0)
      assertAllValuesApprox(outBuff.getChannelData(4), 0)

      input.connect(output1)
      outBuff = input._tick()
      assert.equal(input.computedNumberOfChannels, 5)
      assert.equal(outBuff.numberOfChannels, 5)
      assert.equal(outBuff.length, BLOCK_SIZE)

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
        , input = new AudioInput(dummyContext, sinkNode, 0)
        , output1 = new AudioOutput(dummyContext, sourceNode1, 0)
        , output2 = new AudioOutput(dummyContext, sourceNode2, 0)
        , outBuff

      output1._tick = function() {
        return AudioBuffer.filledWithVal(0.1, 3, BLOCK_SIZE, 44100)
      }
      output2._tick = function() {
        return AudioBuffer.filledWithVal(0.2, 1, BLOCK_SIZE, 44100)
      }

      input.connect(output2)
      outBuff = input._tick()
      assert.equal(input.computedNumberOfChannels, 2)
      assert.equal(outBuff.numberOfChannels, 2)
      assert.equal(outBuff.length, BLOCK_SIZE)

      assertAllValuesApprox(outBuff.getChannelData(0), 0.2)
      assertAllValuesApprox(outBuff.getChannelData(1), 0)

      input.connect(output1)
      outBuff = input._tick()
      assert.equal(input.computedNumberOfChannels, 2)
      assert.equal(outBuff.numberOfChannels, 2)
      assert.equal(outBuff.length, BLOCK_SIZE)

      assertAllValuesApprox(outBuff.getChannelData(0), 0.15)
      assertAllValuesApprox(outBuff.getChannelData(1), 0.05)
    })

    it('should return a buffer with channelCount channels, full of zeros if no connection', function() {
      var sinkNode = {channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'discrete'}
        , sourceNode1 = {channelCount: 4}
        , sourceNode2 = {channelCount: 1}
        , input = new AudioInput(dummyContext, sinkNode, 0)
        , output1 = new AudioOutput(dummyContext, sourceNode1, 0)
        , output2 = new AudioOutput(dummyContext, sourceNode2, 0)
        , outBuff

      output1._tick = function() {
        return AudioBuffer.filledWithVal(0.1, 3, BLOCK_SIZE, 44100)
      }
      output2._tick = function() {
        return AudioBuffer.filledWithVal(0.2, 1, BLOCK_SIZE, 44100)
      }

      input.connect(output2)
      outBuff = input._tick()
      assert.equal(input.computedNumberOfChannels, 2)
      assert.equal(outBuff.numberOfChannels, 2)
      assert.equal(outBuff.length, BLOCK_SIZE)

      assertAllValuesApprox(outBuff.getChannelData(0), 0.2)
      assertAllValuesApprox(outBuff.getChannelData(1), 0)

      input.connect(output1)
      outBuff = input._tick()
      assert.equal(input.computedNumberOfChannels, 2)
      assert.equal(outBuff.numberOfChannels, 2)
      assert.equal(outBuff.length, BLOCK_SIZE)

      assertAllValuesApprox(outBuff.getChannelData(0), 0.15)
      assertAllValuesApprox(outBuff.getChannelData(1), 0.05)
    })

  })

})

describe('AudioOutput', function() {

  var dummyContext = {sampleRate: 44100, currentTime: 0}

  describe('_tick', function() {

    it('should pull the audio once and cache it after', function() {
      var sourceNode = {channelCount: 3}
        , output = new AudioOutput(dummyContext, sourceNode, 0)
        , theBuff = AudioBuffer.filledWithVal(0.24, 1, BLOCK_SIZE, 44100)
        , pulledCounter = 0
        , outBuff

      dummyContext.currentTime = 12
      sourceNode._tick = function() {
        pulledCounter++
        return theBuff
      }
      assert.deepEqual(output._cachedBlock, {time: -1, buffer: null})

      // First _tick, the block should be cached
      outBuff = output._tick()
      assert.equal(outBuff, theBuff)
      assert.equal(output._cachedBlock.time, 12)
      assert.equal(output._cachedBlock.buffer, theBuff)
      assert.equal(pulledCounter, 1)

      // Second _tick, same currentTime, node._tick shouldn't be called again
      outBuff = output._tick()
      assert.equal(outBuff, theBuff)
      assert.equal(output._cachedBlock.time, 12)
      assert.equal(output._cachedBlock.buffer, theBuff)
      assert.equal(pulledCounter, 1)

      // Time moved, now a new block should be returned
      dummyContext.currentTime = 23
      outBuff = output._tick()
      assert.equal(outBuff, theBuff)
      assert.equal(output._cachedBlock.time, 23)
      assert.equal(output._cachedBlock.buffer, theBuff)
      assert.equal(pulledCounter, 2)

    })

    it('should emit event _numberOfChannels when the number of channels changed', function() {
      var sourceNode = {channelCount: 3}
        , output = new AudioOutput(dummyContext, sourceNode, 0)
        , pulledCounter = 0
        , eventsReceived = []

      dummyContext.currentTime = 12
      sourceNode._tick = function() {
        var buff
        if (pulledCounter === 0)
          buff = new AudioBuffer(1, BLOCK_SIZE, 44100)
        else if (pulledCounter === 1)
          buff = new AudioBuffer(2, BLOCK_SIZE, 44100)
        else if (pulledCounter === 2)
          buff = new AudioBuffer(2, BLOCK_SIZE, 44100)
        else if (pulledCounter === 3)
          buff = new AudioBuffer(1, BLOCK_SIZE, 44100)
        pulledCounter++
        return buff
      }

      output.on('_numberOfChannels', function() {
        eventsReceived.push(output._numberOfChannels)
      })

      dummyContext.currentTime = 1
      assert.equal(output._numberOfChannels, null)
      output._tick()
      assert.equal(output._numberOfChannels, 1)
      assert.deepEqual(eventsReceived, [1])

      dummyContext.currentTime = 2
      output._tick()
      assert.equal(output._numberOfChannels, 2)
      assert.deepEqual(eventsReceived, [1, 2])

      dummyContext.currentTime = 3
      output._tick()
      assert.equal(output._numberOfChannels, 2)
      assert.deepEqual(eventsReceived, [1, 2])

      dummyContext.currentTime = 4
      output._tick()
      assert.equal(output._numberOfChannels, 1)
      assert.deepEqual(eventsReceived, [1, 2, 1])

    })

  })

})