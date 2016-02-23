var assert = require('assert')
  , _ = require('underscore')
  , AudioBuffer = require('../build/AudioBuffer')
  , BLOCK_SIZE = require('../build/constants').BLOCK_SIZE
  , PannerNode = require('../build/PannerNode')
  , AudioNode = require('../build/AudioNode')
  , AudioListener = require('../build/AudioListener')

describe('PannerNode', function() {

  describe('_tick', function() {

    var helpers = require('./helpers')({ approx : 0.01 })
      , dummyContext

    beforeEach(function() {
      dummyContext = {
        sampleRate  : 44100,
        currentTime : 0,
        BLOCK_SIZE  : BLOCK_SIZE,
        listener    : new AudioListener(),
      }
    })

    it('should apply the gain for panner position', function() {
      var pannerNode = new PannerNode(dummyContext)
      var sourceNode = new AudioNode(dummyContext, 0, 1)
      var block

      sourceNode.connect(pannerNode)
      sourceNode._tick = function() {
        return AudioBuffer.filledWithVal(1, 2, BLOCK_SIZE, 44100)
      }

      var cases = {
        center : {
          pos  : [0, 0, 0],
          gain : [1, 1],
        },
        '00:00' : {
          pos  : [0, 0, -1],
          gain : [1, 1],
        },
        '01:30' : {
          pos  : [1, 0, -1],
          gain : [0.5, 1.2],
        },
        '03:00' : {
          pos  : [1, 0, 0],
          gain : [0, 2],
        },
        '04:30' : {
          pos  : [1, 0, 1],
          gain : [0.5, 1.2],
        },
        '06:00' : {
          pos  : [0, 0, 1],
          gain : [1, 1],
        },
        '07:30' : {
          pos  : [-1, 0, 1],
          gain : [1.2, 0.5],
        },
        '09:00' : {
          pos  : [-1, 0,  0],
          gain : [2, 0],
        },
        '10:30' : {
          pos  : [-1, 0, -1],
          gain : [1.2, 0.5],
        },
      }

      Object.keys(cases).forEach((key) => {
        var c = cases[key]

        var pos = c.pos
          , gain = c.gain

        dummyContext.currentTime++
        pannerNode.setPosition(pos[0], pos[1], pos[2])
        block = pannerNode._tick()
        assert.equal(block.numberOfChannels, 2)
        assert.equal(block.length, BLOCK_SIZE)
        helpers.assertAllValuesApprox(block.getChannelData(0), gain[0], key)
        helpers.assertAllValuesApprox(block.getChannelData(1), gain[1], key)
      })
    })

  })

})
