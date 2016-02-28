var assert = require('assert')
  , BLOCK_SIZE = require('../../build/constants').BLOCK_SIZE
  , ConeEffect = require('../../build/PannerNode/ConeEffect')
  , FloatPoint3D = require('../../build/FloatPoint3D')
  , helpers = require('../helpers')()

var assertApproxEqual = helpers.assertApproxEqual

describe('ConeEffect', function() {

  const dummyContext = { sampleRate : 44100, currentTime : 0, BLOCK_SIZE : BLOCK_SIZE }

  describe('constructor', function() {
    it('has default values for properties', function() {
      const c = new ConeEffect()
      assert.equal(c.innerAngle, 360)
      assert.equal(c.outerAngle, 360)
      assert.equal(c.outerGain, 0)
    })
  })

  describe('setters', function() {
    const c = new ConeEffect()

    it('throws TypeError if innerAngle is finite', function() {
      assert.doesNotThrow(function() { c.innerAngle = 1 })
      assert.throws(function() { c.innerAngle = NaN })
      assert.throws(function() { c.innerAngle = 1 / 0 })
    })

    it('throws TypeError if outerAngle is finite', function() {
      assert.doesNotThrow(function() { c.outerAngle = 1 })
      assert.throws(function() { c.outerAngle = NaN })
      assert.throws(function() { c.outerAngle = 1 / 0 })
    })

    it('throws TypeError if outerGain is not finite', function() {
      assert.doesNotThrow(function() { c.outerGain = 1 })
      assert.throws(function() { c.outerGain = NaN })
      assert.throws(function() { c.outerGain = 1 / 0 })
    })

    it('MUST throw InvalidStateError if outerGain is ', function() {
      assert.doesNotThrow(function() { c.outerGain = 0 })
      assert.doesNotThrow(function() { c.outerGain = 1 })
      assert.throws(function() { c.outerGain = -1 }, 'InvalidStateError')
      assert.throws(function() { c.outerGain = 2 }, 'InvalidStateError')
    })
  })

  describe('gain', function() {
    const c = new ConeEffect()

    const gain = function(sp, so, lp) {
      const sourcePosition    = new FloatPoint3D(sp[0], sp[1], sp[2])
      const sourceOrientation = new FloatPoint3D(so[0], so[1], so[2])
      const listenerPosition  = new FloatPoint3D(lp[0], lp[1], lp[2])
      return c.gain(sourcePosition, sourceOrientation, listenerPosition)
    }

    it('works', function() {
      c.innerAngle = 90
      c.outerAngle = 270
      assertApproxEqual(gain([0, 0, 0], [0, 0, 1], [0, 0, 1]), 1.0)  // front
      assertApproxEqual(gain([0, 0, 0], [0, 0, 1], [1, 0, 1]), 1.0)  // front-left
      assertApproxEqual(gain([0, 0, 0], [0, 0, 1], [-1, 0, 1]), 1.0) // front-right
      assertApproxEqual(gain([0, 0, 0], [0, 0, 1], [1, 0, 0]), 0.5)  // left
      assertApproxEqual(gain([0, 0, 0], [0, 0, 1], [-1, 0, 0]), 0.5) // right
      assertApproxEqual(gain([0, 0, 0], [0, 0, 1], [1, 0, -1]), 0)   // rear-left
      assertApproxEqual(gain([0, 0, 0], [0, 0, 1], [-1, 0, -1]), 0)  // rear-right
      assertApproxEqual(gain([0, 0, 0], [0, 0, 1], [0, 0, -1]), 0)   // rear
    })
  })

})
