var assert = require('assert'),
  OscillatorNode = require('../build/OscillatorNode'),
  BLOCK_SIZE = require('../build/constants').BLOCK_SIZE

describe('OscillatorNode', function() {
  describe('_tick', function() {
    var helpers = require('./helpers')()
      ,dummyContext

    beforeEach(function() {
      dummyContext = {
        sampleRate: 44100,
        currentTime: 0,
        BLOCK_SIZE: BLOCK_SIZE
      }
    })

    it('should pull zeros when reading not started', function() {
      var node = new OscillatorNode(dummyContext),
        block
      while (dummyContext.currentTime < 2) {
        dummyContext.currentTime++
        block = node._tick()
        assert.equal(block.length, 128)
        assert.equal(block.numberOfChannels, 1)
        helpers.assertAllValuesEqual(block.getChannelData(0), 0)
      }
    })

    it('should pull the audio from the buffer', function() {
      var node = new OscillatorNode(dummyContext)
        , blocks = []
      node.start(1)
      while(dummyContext.currentTime < 7) {
        blocks.push(node._tick())
        dummyContext.currentTime += 1
      }
      helpers.assertAllValuesEqual(blocks[0].getChannelData(0), 0)
      // generate sinusoid datas
      var f = 400
      var w = 2 * Math.PI * f / dummyContext.sampleRate
      var sinus = []
      for(var i=0; i<7*128; i++){
        sinus.push(Math.sin(w * i))
      }
      helpers.assertAllValuesEqual(blocks[0].getChannelData(0), 0)

      for(var j=1; j<7; j++){
        var outputArrayBuffer = Array.prototype.slice.call(blocks[j].getChannelData(0))
        var outputSinusArray = sinus.slice((j-1)*128, j*128)
        for(var l=0; l<128; l++){
          helpers.assertApproxEqual(outputArrayBuffer[l], outputSinusArray[l])
        }
      }
    })

  })
  describe('stop', function() {
    it('should stop the playing', function() {

    })
  })
})
