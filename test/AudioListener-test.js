var assert = require('assert')
  , AudioListener = require('../build/AudioListener')

describe('AudioListener', function() {

  describe('constructor', function() {
    it('has default properties', function() {
      const a = new AudioListener()
      assert.deepEqual(a.position.toArray(), [0, 0, 0])
      assert.deepEqual(a.orientation.toArray(), [0, 0, -1])
      assert.deepEqual(a.upVector.toArray(), [0, 1, 0])
      assert.deepEqual(a.velocity.toArray(), [0, 0, 0])
    })
  })

  describe('setters', function() {
    const a = new AudioListener()

    it('has setPosition', function() {
      a.setPosition(1, 2, 3)
      assert.deepEqual(a.position.toArray(), [1, 2, 3])
    })

    it('has setOrientation', function() {
      a.setOrientation(4, 5, 6, 7, 8, 9)
      assert.deepEqual(a.orientation.toArray(), [4, 5, 6])
      assert.deepEqual(a.upVector.toArray(), [7, 8, 9])
    })
  })
})
