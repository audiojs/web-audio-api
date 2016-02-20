var assert = require('assert'),
  _ = require('underscore'),
  AudioBuffer = require('../build/AudioBuffer'),
  BLOCK_SIZE = require('../build/constants').BLOCK_SIZE,
  DelayNode = require('../build/DelayNode'),
  AudioNode = require('../build/AudioNode');

describe('DelayNode', function() {

  describe('_tick', function() {

    var helpers = require('./helpers')(),
      dummyContext;

    beforeEach(function() {
      dummyContext = {
        sampleRate: 44100,
        currentTime: 0,
        BLOCK_SIZE: BLOCK_SIZE
      };
    });

    it('should apply the delay to its input', function() {
      // Init the test with a DelayNode,
      // and AudioNode (sourceNode), in charge of reading
      // a random buffer initialized during thet test.
      // Random buffer length: 88200
      var delayNode = new DelayNode(dummyContext),
        sourceNode = new AudioNode(dummyContext, 0, 1),
        block, testAudioBuffer, dataTestAudioBuffer

      // create test audio buffer
      dataTestAudioBuffer = [
        [],
        []
      ]
      for (var i = 0; i < 88200; i++) {
        dataTestAudioBuffer[0][i] = (Math.random() - 0.5) * 2
        dataTestAudioBuffer[1][i] = (Math.random() - 0.5) * 2
      }
      testAudioBuffer = AudioBuffer.fromArray(dataTestAudioBuffer, 44100)

      sourceNode.connect(delayNode);
      sourceNode._tick = function() {
        return testAudioBuffer.slice(dummyContext.currentTime * BLOCK_SIZE, (dummyContext.currentTime + 1) * BLOCK_SIZE)
      };
      dummyContext.currentTime += 128 / 44100;
      delayNode.delayTime.value = 0.002; // which is approximatively 88 samples a 44.1
      block = delayNode._tick();
      assert.equal(block.numberOfChannels, 2);
      assert.equal(block.length, BLOCK_SIZE);
      var arraybuffer = Array.prototype.slice.call(block.getChannelData(0));
      for (var i = 0; i < BLOCK_SIZE; i++) {
        if (i < 88) assert.equal(arraybuffer[i], 0)
        else helpers.assertApproxEqual(arraybuffer[i], dataTestAudioBuffer[0][i - 88])
      }
    });

  });

});
