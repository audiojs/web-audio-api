import assert from 'assert'
import Panner from '../../src/PannerNode/Panner.js'

describe('Panner.js', function() {
  it('must not be used directly', function() {
    const p = new Panner()
    assert.throws(function() { p.pan() })
  })
})
