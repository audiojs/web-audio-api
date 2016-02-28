var assert = require('assert')
  , BLOCK_SIZE = require('../../build/constants').BLOCK_SIZE
  , PannerProvider = require('../../build/PannerNode/PannerProvider')
  , EqualPowerPanner = require('../../build/PannerNode/EqualPowerPanner')

describe('PannerProvider', function() {

  const dummyContext = { sampleRate : 44100, currentTime : 0, BLOCK_SIZE : BLOCK_SIZE }

  describe('constructor', function() {

    const p = new PannerProvider(dummyContext)

    it('manages panningModel and panner as properties', function() {
      assert.equal(p.panningModel, 'equalpower')
      assert(p.panner instanceof EqualPowerPanner)
    })

    it('throws TypeError if panningModel is invalid', function() {
      assert.throws(function() {
        p.panningModel = 'HRTF'
      }, 'HRTF panner is not implemented')

      assert.throws(function() {
        p.panningModel = 'foo'
      }, 'invalid panningModel causes TypeError')
    })
  })

})
