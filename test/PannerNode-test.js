var assert = require('assert')
  , AudioBuffer = require('../build/AudioBuffer')
  , BLOCK_SIZE = require('../build/constants').BLOCK_SIZE
  , PannerNode = require('../build/PannerNode')
  , AudioNode = require('../build/AudioNode')
  , AudioListener = require('../build/AudioListener')

describe('PannerNode', function() {

  var helpers = require('./helpers')({ approx : 0.01 })
    , dummyContext = {
      sampleRate  : 44100,
      currentTime : 0,
      BLOCK_SIZE  : BLOCK_SIZE,
      listener    : new AudioListener(),
    }

  var testBlockGain = function(block, gainL, gainR) {
    assert.equal(block.numberOfChannels, 2)
    assert.equal(block.length, BLOCK_SIZE)
    helpers.assertAllValuesApprox(block.getChannelData(0), gainL)
    helpers.assertAllValuesApprox(block.getChannelData(1), gainR)
  }

  describe('constructor', function() {
    it('sets attributes to default values', function() {
      var pannerNode = new PannerNode(dummyContext)
      assert.equal(pannerNode.channelCount, 2)
      assert.equal(pannerNode.channelCountMode, 'clamped-max')
      assert.equal(pannerNode.coneInnerAngle, 360)
      assert.equal(pannerNode.coneOuterAngle, 360)
      assert.equal(pannerNode.coneOuterGain, 0)
      assert.equal(pannerNode.distanceModel, 'inverse')
      assert.equal(pannerNode.maxDistance, 10000)
      assert.equal(pannerNode.panningModel, 'equalpower')
      assert.equal(pannerNode.refDistance, 1)
      assert.equal(pannerNode.rolloffFactor, 1)
    })
  })

  describe('_tick', function() {
    var pannerNode, sourceNode

    beforeEach(function() {
      pannerNode = new PannerNode(dummyContext)
      sourceNode = new AudioNode(dummyContext, 0, 1)
      sourceNode.connect(pannerNode)
      sourceNode._tick = function() {
        return AudioBuffer.filledWithVal(1, 2, BLOCK_SIZE, 44100)
      }
    })

    it('should apply the gain for panner position', function() {
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

      Object.keys(cases).forEach(function(key) {
        var c = cases[key]

        var pos = c.pos
          , gain = c.gain

        pannerNode._resetPanner()
        pannerNode.setPosition(pos[0], pos[1], pos[2])

        dummyContext.currentTime++
        var block = pannerNode._tick()
        testBlockGain(block, gain[0], gain[1])
      })
    })

    it('should apply the gain for coneEffect parameters', function() {
      var test = function(innerAngle, outerAngle, outerGain, expectedGain) {
        pannerNode.coneInnerAngle = innerAngle
        pannerNode.coneOuterAngle = outerAngle
        pannerNode.coneOuterGain  = outerGain

        dummyContext.currentTime++
        var block = pannerNode._tick()
        testBlockGain(block, expectedGain, expectedGain)
      }

      pannerNode.setPosition(0, 0, -1)

      // The listener is in front of the speaker
      pannerNode.setOrientation(0, 0, 1)
      test(360, 360, 0, 1)
      test(360, 360, 1, 1)
      test(0, 360, 0, 1)
      test(0, 360, 1, 1)
      test(0, 180, 0, 1)
      test(0, 180, 1, 1)

      // The listener is behind the speaker
      pannerNode.setOrientation(0, 0, -1)
      test(360, 360, 0, 1)
      test(360, 360, 1, 1)
      test(0, 360, 0, 0)
      test(0, 360, 1, 1)
      test(0, 180, 0, 0)
      test(0, 180, 1, 1)

      // The listener is on right of the speaker
      pannerNode.setOrientation(1, 0, 0)
      test(360, 360, 0, 1)
      test(360, 360, 1, 1)
      test(0, 360, 0, 0.5)
      test(0, 360, 1, 1)
      test(0, 180, 0, 0)
      test(0, 180, 1, 1)
    })
  })

  describe('setPosition', function() {
    it('throws TypeErrors for invalid parameter', function() {
      assert.throws(function() {
        new PannerNode(dummyContext).setPosition(1)
      }, TypeError)
      assert.throws(function() {
        new PannerNode(dummyContext).setPosition(1, 2)
      }, TypeError)
      assert.throws(function() {
        new PannerNode(dummyContext).setPosition(NaN, NaN, NaN)
      }, TypeError)

      assert.doesNotThrow(function() {
        new PannerNode(dummyContext).setPosition(1, 2, 3)
      }, 'Position must be a 3D vector of finite numbers')
    })
  })

  describe('setVelocity', function() {
    it('throws TypeErrors for invalid parameter', function() {
      assert.throws(function() {
        new PannerNode(dummyContext).setVelocity(1)
      }, TypeError)
      assert.throws(function() {
        new PannerNode(dummyContext).setVelocity(1, 2)
      }, TypeError)
      assert.throws(function() {
        new PannerNode(dummyContext).setVelocity(NaN, NaN, NaN)
      }, TypeError)

      assert.doesNotThrow(function() {
        new PannerNode(dummyContext).setVelocity(1, 2, 3)
      }, 'Velocity must be a 3D vector of finite numbers')
    })
  })

  describe('channelCount', function() {
    it('throws NotSupportedError for invalid parameter', function() {
      assert.throws(function() {
        new PannerNode(dummyContext).channelCount = 0
      }, 'NotSupportedError')
      assert.throws(function() {
        new PannerNode(dummyContext).channelCount = 3
      }, 'NotSupportedError')

      assert.doesNotThrow(function() {
        new PannerNode(dummyContext).channelCount = 1
      }, 'monoral is okay')
      assert.doesNotThrow(function() {
        new PannerNode(dummyContext).channelCount = 2
      }, 'stereo is okay')
    })
  })

  describe('channelCountMode', function() {
    it('throws errors for invalid parameter', function() {
      assert.throws(function() {
        new PannerNode(dummyContext).channelCountMode = 'foo'
      }, 'TypeError')
      assert.throws(function() {
        new PannerNode(dummyContext).channelCountMode = 'max'
      }, 'NotSupportedError', 'PannerNode does not support "clamped-max"')

      assert.doesNotThrow(function() {
        new PannerNode(dummyContext).channelCountMode = 'clamped-max'
      }, '"max" is okay')
      assert.doesNotThrow(function() {
        new PannerNode(dummyContext).channelCountMode = 'explicit'
      }, '"explicit" is okay')
    })
  })

})
