var assert = require('assert')
  , Panner = require('../../build/PannerNode/Panner')

describe('Panner', function() {
  it('must not be used directly', function() {
    const p = new Panner()
    assert.throws(function() { p.pan() })
  })
})
