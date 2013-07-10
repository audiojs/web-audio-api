var assert = require('assert')
  , DspObject = require('../lib/DspObject')

describe('DspObject', function() {

  var dummyContext

  beforeEach(function() {
    dummyContext = {currentTime: 0}
  })

  describe('_schedule', function() {

    it('should insert events at the right position', function() {
      var dspObj = new DspObject(dummyContext)
        , cb = function() {}

      dspObj._scheduled = [{time: 2, func: cb}, {time: 3, func: cb},
        {time: 7, func: cb}, {time: 11, func: cb}]

      dspObj._schedule(cb, 1)
      assert.deepEqual(dspObj._scheduled, [{time: 1, func: cb}, {time: 2, func: cb},
        {time: 3, func: cb}, {time: 7, func: cb}, {time: 11, func: cb}])

      dspObj._schedule(cb, 13)
      assert.deepEqual(dspObj._scheduled, [{time: 1, func: cb}, {time: 2, func: cb},
        {time: 3, func: cb}, {time: 7, func: cb}, {time: 11, func: cb}, {time: 13, func: cb}])

      dspObj._schedule(cb, 9)
      assert.deepEqual(dspObj._scheduled, [{time: 1, func: cb}, {time: 2, func: cb},
        {time: 3, func: cb}, {time: 7, func: cb}, {time: 9, func: cb}, {time: 11, func: cb},
        {time: 13, func: cb}])

      dspObj._schedule(cb, 2)
      assert.deepEqual(dspObj._scheduled, [{time: 1, func: cb}, {time: 2, func: cb},
        {time: 2, func: cb}, {time: 3, func: cb}, {time: 7, func: cb}, {time: 9, func: cb},
        {time: 11, func: cb}, {time: 13, func: cb}])
    })

  })

  describe('_tick', function() {

    it('should execute simple events rightly', function() {
      var called = []
        , dspObj = new DspObject(dummyContext)
      dspObj._schedule(function() { called.push(1) }, 9)
      dspObj._schedule(function() { called.push(2) }, 3.51)
      dspObj._schedule(function() { called.push(3) }, 2.55)
      
      // t=0
      dspObj._tick()
      assert.deepEqual(called, [])
      dummyContext.currentTime += 2.56

      // t=2.56
      dspObj._tick()
      assert.deepEqual(called, [3])
      dummyContext.currentTime += 1.44

      // t=4
      dspObj._tick()
      assert.deepEqual(called, [3, 2])
      dummyContext.currentTime += 2

      // t=6
      dspObj._tick()
      assert.deepEqual(called, [3, 2])
      dummyContext.currentTime += 3

      // t=9
      dspObj._tick()
      assert.deepEqual(called, [3, 2, 1])
      assert.deepEqual(dspObj._scheduled, [])
    })

  })

})