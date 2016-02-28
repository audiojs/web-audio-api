var assert = require('assert')
  , sinon = require('sinon')
  , BLOCK_SIZE = require('../../build/constants').BLOCK_SIZE
  , DistanceEffect = require('../../build/PannerNode/DistanceEffect')

describe('DistanceEffect', function() {

  const dummyContext = { sampleRate : 44100, currentTime : 0, BLOCK_SIZE : BLOCK_SIZE }

  describe('constructor', function() {
    it('has default values for properties', function() {
      const d = new DistanceEffect()
      assert.equal(d.model, 'inverse')
      assert.equal(d.refDistance, 1.0)
      assert.equal(d.maxDistance, 10000)
      assert.equal(d.rolloffFactor, 1.0)
    })
  })

  describe('setters', function() {
    const d = new DistanceEffect()

    it('throws Error if model is invalid', function() {
      assert.doesNotThrow(function() { d.setModel('inverse', false) })
      assert.doesNotThrow(function() { d.setModel('linear', false) })
      assert.doesNotThrow(function() { d.setModel('exponential', false) })
      assert.throws(function() { d.setModel('yo', false) })
    })

    it('throws Error if refDistance is invalid', function() {
      assert.doesNotThrow(function() { d.refDistance = 1 })
      assert.throws(function() { d.refDistance = NaN })
      assert.throws(function() { d.refDistance = 1 / 0 })
    })

    it('throws Error if maxDistance is invalid', function() {
      assert.doesNotThrow(function() { d.maxDistance = 1 })
      assert.throws(function() { d.maxDistance = NaN })
      assert.throws(function() { d.maxDistance = 1 / 0 })
    })

    it('throws Error if rolloffFactor is invalid', function() {
      assert.doesNotThrow(function() { d.rolloffFactor = 1 })
      assert.throws(function() { d.rolloffFactor = NaN })
      assert.throws(function() { d.rolloffFactor = 1 / 0 })
    })
  })

  describe('gain', function() {
    const d = new DistanceEffect()

    it('calls relevant gain method for the model', function() {
      const noop = function() {}
      const inverseGain     = sinon.stub(DistanceEffect.prototype, 'inverseGain', noop)
      const linearGain      = sinon.stub(DistanceEffect.prototype, 'linearGain', noop)
      const exponentialGain = sinon.stub(DistanceEffect.prototype, 'exponentialGain', noop)

      d.setModel('inverse', false)
      d.gain(123)
      assert(inverseGain.calledOnce)
      assert.equal(inverseGain.args[0][0], 123)

      d.setModel('linear', false)
      d.gain(456)
      assert(linearGain.calledOnce)
      assert.equal(linearGain.args[0][0], 456)

      d.setModel('exponential', false)
      d.gain(789)
      assert(exponentialGain.calledOnce)
      assert.equal(exponentialGain.args[0][0], 789)

      inverseGain.restore()
      linearGain.restore()
      exponentialGain.restore()
    })
  })

})
