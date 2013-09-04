var assert = require('assert')
  , _ = require('underscore')
  , utils = require('../lib/utils')
  , audioports = require('../lib/audioports')
  , AudioOutput = audioports.AudioOutput
  , AudioInput = audioports.AudioInput
  , AudioBuffer = require('audiobuffer')
  , BLOCK_SIZE = require('../lib/constants').BLOCK_SIZE
  , assertAllValuesApprox = require('./helpers')().assertAllValuesApprox


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

  describe('_kill', function() {

    it('should disconnect everything and remove event listeners', function() {
      var sink1 = new AudioInput(dummyContext, dummyNode, 0)
        , sink2 = new AudioInput(dummyContext, dummyNode, 0)
        , source = new AudioOutput(dummyContext, dummyNode, 1)

      sink1.connect(source)
      sink2.connect(source)
      source.on('bla', function() {})
      assert.equal(source.listeners('bla').length, 1)
      assert.deepEqual(sink1.sources, [source])
      assert.deepEqual(sink2.sources, [source])

      source._kill()
      assert.deepEqual(sink1.sources, [])
      assert.deepEqual(sink2.sources, [])
      assert.equal(source.listeners('bla').length, 0)
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

    it('should get 1 when channelCountMode is max or clamped-max and there is no connection', function() {
      var dummyNode = {channelCount: 6, channelCountMode: 'max'}
        , input = new AudioInput(dummyContext, dummyNode, 0)
      input._computeNumberOfChannels(0)
      assert.equal(input.computedNumberOfChannels, 1)
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

    // Assert that all values for each channel of `outBuff` are equal to the corresponding
    // channel in `values`.
    // e.g. assertChannelsEqual(outBuff, [11, 22, 33])
    var assertChannelsEqual = function(outBuff, values) {
      var ch, numberOfChannels = values.length
      assert.equal(outBuff.numberOfChannels, numberOfChannels)
      assert.equal(outBuff.length, BLOCK_SIZE)

      for (ch = 0; ch < numberOfChannels; ch++)
        assertAllValuesApprox(outBuff.getChannelData(ch), values[ch])
    }

    // Helper to return an Output which has `channelCount` and whose
    // values are `values`, one value for each channel
    var getOutput = function(values) {
      var channelCount = values.length
        , output = new AudioOutput(dummyContext, {channelCount: channelCount}, 0)
        , array = []
        , ch, i

      for (ch = 0; ch < channelCount; ch++) {
        array[ch] = []
        for (i = 0; i < BLOCK_SIZE; i++)
          array[ch][i] = values[ch]
      }

      output._tick = function() {
        return AudioBuffer.fromArray(array, 44100)
      }
      return output
    } 

    it('should just copy if number of channels are the same', function() {
      var sinkNode = {channelCount: 3, channelCountMode: 'explicit', channelInterpretation: 'discrete'}
        , input = new AudioInput(dummyContext, sinkNode, 0)
        , output1 = getOutput([0.1, 0.2, 0.3])
        , output2 = getOutput([0.01, 0.02, 0.03])

      input.connect(output1)
      input.connect(output2)
      assertChannelsEqual(input._tick(), [0.11, 0.22, 0.33])
      assert.equal(input.computedNumberOfChannels, 3)
    })

    describe('channelInterpretation: \'discrete\'', function() {

      it('should up-mix by adding zeros in discrete mode', function() {
        var sinkNode = {channelCount: 5, channelCountMode: 'explicit', channelInterpretation: 'discrete'}
          , input = new AudioInput(dummyContext, sinkNode, 0)
          , output1 = getOutput([0.1, 0.1, 0.1])
          , output2 = getOutput([0.2])

        input.connect(output2)
        assertChannelsEqual(input._tick(), [0.2, 0, 0, 0, 0])
        assert.equal(input.computedNumberOfChannels, 5)

        input.connect(output1)
        assertChannelsEqual(input._tick(), [0.3, 0.1, 0.1, 0, 0])
        assert.equal(input.computedNumberOfChannels, 5)
      })

      it('should down-mix by dropping channels in discrete mode', function() {
        var sinkNode = {channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'discrete'}
          , input = new AudioInput(dummyContext, sinkNode, 0)
          , output1 = getOutput([0.1, 0.1, 0.1, 0.1])
          , output2 = getOutput([0.2])

        input.connect(output2)
        assertChannelsEqual(input._tick(), [0.2, 0])
        assert.equal(input.computedNumberOfChannels, 2)

        input.connect(output1)
        assertChannelsEqual(input._tick(), [0.3, 0.1])
        assert.equal(input.computedNumberOfChannels, 2)
      })

      it('should return a buffer with channelCount channels, full of zeros if no connection', function() {
        var sinkNode = {channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'discrete'}
          , input = new AudioInput(dummyContext, sinkNode, 0)
          , output1 = getOutput([0.1, 0.1, 0.1, 0.1])
          , output2 = getOutput([0.2])

        assertChannelsEqual(input._tick(), [0, 0])
        assert.equal(input.computedNumberOfChannels, 2)

        input.connect(output2)
        input.connect(output1)
        assertChannelsEqual(input._tick(), [0.3, 0.1])
        assert.equal(input.computedNumberOfChannels, 2)
      })

      it('should return a buffer with 1 channel in (clamped-)max mode, full of zeros if no connection', function() {
        var sinkNode = {channelCountMode: 'max', channelInterpretation: 'discrete'}
          , input = new AudioInput(dummyContext, sinkNode, 0)

        outBuff = input._tick()
        assert.equal(input.computedNumberOfChannels, 1)
        assert.equal(outBuff.numberOfChannels, 1)
        assert.equal(outBuff.length, BLOCK_SIZE)

        assertAllValuesApprox(outBuff.getChannelData(0), 0)
      })

    })

    describe('channelInterpretation: \'speakers\'', function() {

      it('should revert from speakers to discrete when the up/down mix doesn\'t correspond to known layout', function() {
        var sinkNode = {channelCount: 3, channelCountMode: 'explicit', channelInterpretation: 'speakers'}
          , input = new AudioInput(dummyContext, sinkNode, 0)
          , output = getOutput([0.3])

        input.connect(output)
        assertChannelsEqual(input._tick(), [0.3, 0, 0])
        assert.equal(input.computedNumberOfChannels, 3)        
      })

      describe('same number channels', function() {

      })

      describe('mono up-mix', function() {

        it('1 -> 2', function() {
          var sinkNode = {channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'speakers'}
            , input = new AudioInput(dummyContext, sinkNode, 0)
            , output1 = getOutput([0.1])
            , output2 = getOutput([0.2])

          input.connect(output1)
          input.connect(output2)
          assertChannelsEqual(input._tick(), [0.3, 0.3])
          assert.equal(input.computedNumberOfChannels, 2)
        })

        it('1 -> 4', function() {
          var sinkNode = {channelCount: 4, channelCountMode: 'explicit', channelInterpretation: 'speakers'}
            , input = new AudioInput(dummyContext, sinkNode, 0)
            , output1 = getOutput([0.1])
            , output2 = getOutput([0.2])

          input.connect(output1)
          input.connect(output2)
          assertChannelsEqual(input._tick(), [0.3, 0.3, 0, 0])
          assert.equal(input.computedNumberOfChannels, 4)
        })

        it('1 -> 5.1', function() {
          var sinkNode = {channelCount: 6, channelCountMode: 'explicit', channelInterpretation: 'speakers'}
            , input = new AudioInput(dummyContext, sinkNode, 0)
            , output1 = getOutput([0.1])
            , output2 = getOutput([0.2])

          input.connect(output1)
          input.connect(output2)
          assertChannelsEqual(input._tick(), [0, 0, 0.3, 0, 0, 0])
          assert.equal(input.computedNumberOfChannels, 6)
        })

      })

      describe('stereo up-mix', function() {

        it('2 -> 4', function() {
          var sinkNode = {channelCount: 4, channelCountMode: 'explicit', channelInterpretation: 'speakers'}
            , input = new AudioInput(dummyContext, sinkNode, 0)
            , output1 = getOutput([0.1, 0.2])
            , output2 = getOutput([0.04, 0.04])

          input.connect(output1)
          input.connect(output2)
          assertChannelsEqual(input._tick(), [0.14, 0.24, 0, 0])
          assert.equal(input.computedNumberOfChannels, 4)
        })

        it('2 -> 5.1', function() {
          var sinkNode = {channelCount: 6, channelCountMode: 'explicit', channelInterpretation: 'speakers'}
            , input = new AudioInput(dummyContext, sinkNode, 0)
            , output1 = getOutput([0.1, 0.2])
            , output2 = getOutput([0.04, 0.04])

          input.connect(output1)
          input.connect(output2)
          assertChannelsEqual(input._tick(), [0.14, 0.24, 0, 0, 0, 0])
          assert.equal(input.computedNumberOfChannels, 6)
        })

      })

      describe('quad up-mix', function() {

        it('4 -> 5.1', function() {
          var sinkNode = {channelCount: 6, channelCountMode: 'explicit', channelInterpretation: 'speakers'}
            , input = new AudioInput(dummyContext, sinkNode, 0)
            , output1 = getOutput([0.1, 0.2, 0.3, 0.4])
            , output2 = getOutput([0.04, 0.04, 0.04, 0.04])

          input.connect(output1)
          input.connect(output2)
          assertChannelsEqual(input._tick(), [0.14, 0.24, 0, 0, 0.34, 0.44])
          assert.equal(input.computedNumberOfChannels, 6)
        })

      })

      describe('mono down-mix', function() {

        it('2 -> 1', function() {
          var sinkNode = {channelCount: 1, channelCountMode: 'explicit', channelInterpretation: 'speakers'}
            , input = new AudioInput(dummyContext, sinkNode, 0)
            , output1 = getOutput([0.1, 0.2])
            , output2 = getOutput([0.04, 0.04])

          input.connect(output1)
          input.connect(output2)
          assertChannelsEqual(input._tick(), [0.5 * ((0.1 + 0.04) + (0.2 + 0.04))])
          assert.equal(input.computedNumberOfChannels, 1)
        })

        it('4 -> 1', function() {
          var sinkNode = {channelCount: 1, channelCountMode: 'explicit', channelInterpretation: 'speakers'}
            , input = new AudioInput(dummyContext, sinkNode, 0)
            , output1 = getOutput([0.1, 0.2, 0.3, 0.4])
            , output2 = getOutput([0.04, 0.04, 0.04, 0.04])

          input.connect(output1)
          input.connect(output2)
          assertChannelsEqual(input._tick(), [(
            (0.1 + 0.04)
            + (0.2 + 0.04)
            + (0.3 + 0.04)
            + (0.4 + 0.04)
          ) * 0.25])
          assert.equal(input.computedNumberOfChannels, 1)
        })

        it('5.1 -> 1', function() {
          var sinkNode = {channelCount: 1, channelCountMode: 'explicit', channelInterpretation: 'speakers'}
            , input = new AudioInput(dummyContext, sinkNode, 0)
            , output1 = getOutput([0.1, 0.2, 0.3, 0.4, 0.5, 0.6])
            , output2 = getOutput([0.04, 0.04, 0.04, 0.04, 0.04, 0.04])

          input.connect(output1)
          input.connect(output2)
          assertChannelsEqual(input._tick(), [
            0.7071 * ((0.1 + 0.04) + (0.2 + 0.04))
            + (0.3 + 0.04)
            + 0.5 * ((0.5 + 0.04) + (0.6 + 0.04))
          ])
          assert.equal(input.computedNumberOfChannels, 1)
        })

      })

      describe('stereo down-mix', function() {

        it('4 -> 2', function() {
          var sinkNode = {channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'speakers'}
            , input = new AudioInput(dummyContext, sinkNode, 0)
            , output1 = getOutput([0.1, 0.2, 0.3, 0.4])
            , output2 = getOutput([0.04, 0.04, 0.04, 0.04])

          input.connect(output1)
          input.connect(output2)
          assertChannelsEqual(input._tick(), [
            0.5 * ((0.1 + 0.04) + (0.3 + 0.04)),
            0.5 * ((0.2 + 0.04) + (0.4 + 0.04))
          ])
          assert.equal(input.computedNumberOfChannels, 2)
        })

        it('5.1 -> 2', function() {
          var sinkNode = {channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'speakers'}
            , input = new AudioInput(dummyContext, sinkNode, 0)
            , output1 = getOutput([0.1, 0.2, 0.3, 0.4, 0.5, 0.6])
            , output2 = getOutput([0.04, 0.04, 0.04, 0.04, 0.04, 0.04])

          input.connect(output1)
          input.connect(output2)
          assertChannelsEqual(input._tick(), [
            (0.1 + 0.04) + 0.7071 * ((0.3 + 0.04) + (0.5 + 0.04)),
            (0.2 + 0.04) + 0.7071 * ((0.3 + 0.04) + (0.6 + 0.04))
          ])
          assert.equal(input.computedNumberOfChannels, 2)
        })

      })

      describe('quad down-mix', function() {

        it('5.1 -> 4', function() {
          var sinkNode = {channelCount: 4, channelCountMode: 'explicit', channelInterpretation: 'speakers'}
            , input = new AudioInput(dummyContext, sinkNode, 0)
            , output1 = getOutput([0.1, 0.2, 0.3, 0.4, 0.5, 0.6])
            , output2 = getOutput([0.04, 0.04, 0.04, 0.04, 0.04, 0.04])

          input.connect(output1)
          input.connect(output2)
          assertChannelsEqual(input._tick(), [
            (0.1 + 0.04) + 0.7071 * (0.3 + 0.04),
            (0.2 + 0.04) + 0.7071 * (0.3 + 0.04),
            (0.5 + 0.04),
            (0.6 + 0.04)
          ])
          assert.equal(input.computedNumberOfChannels, 4)
        })

      })

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