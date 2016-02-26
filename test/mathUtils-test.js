var assert = require('assert')
  , mathUtils = require('../build/mathUtils')

describe('mathUtil', function() {

  describe('fixNANs', function() {
    it('should return 0 if the argument is not finite', function() {
      assert.equal(mathUtils.fixNANs(1 / 0), 0)
      assert.equal(mathUtils.fixNANs(-1 / 0), 0)
      assert.equal(mathUtils.fixNANs(NaN), 0)
      assert.equal(mathUtils.fixNANs(123), 123, 'it returns finite values')
    })
  })

  describe('rad2deg', function() {
    it('converts rad to deg', function() {
      assert.equal(mathUtils.rad2deg(0), 0)
      assert.equal(mathUtils.rad2deg(Math.PI), 180)
    })
  })

  describe('clampTo', function() {
    it('clamps the value between given range', function() {
      assert.equal(mathUtils.clampTo(100, 0, 1), 1)
      assert.equal(mathUtils.clampTo(-100, 0, 1), 0)
      assert.equal(mathUtils.clampTo(0.5, 0, 1), 0.5)
    })
  })

})
