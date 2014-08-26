var assert = require('assert')
  , _ = require('underscore')
  , DspObject = require('../build/DspObject')

describe('DspObject', function() {

  var dummyContext

  beforeEach(function() {
    dummyContext = {currentTime: 0}
  })

  describe('_schedule', function() {

    it('should keep the list of events sorted', function() {
      var dspObj = new DspObject(dummyContext)
        , cb = function() {}

      dspObj._scheduled = [{time: 2, func: cb, type: 'bla'}, {time: 3, func: cb, type: 'bla'},
        {time: 7, func: cb, type: 'bla'}, {time: 11, func: cb, type: 'bla'}]

      dspObj._schedule('bla', 1, cb)
      assert.deepEqual(dspObj._scheduled, [{time: 1, func: cb, type: 'bla'}, {time: 2, func: cb, type: 'bla'},
        {time: 3, func: cb, type: 'bla'}, {time: 7, func: cb, type: 'bla'}, {time: 11, func: cb, type: 'bla'}])

      dspObj._schedule('bla', 13, cb)
      assert.deepEqual(dspObj._scheduled, [{time: 1, func: cb, type: 'bla'}, {time: 2, func: cb, type: 'bla'},
        {time: 3, func: cb, type: 'bla'}, {time: 7, func: cb, type: 'bla'}, {time: 11, func: cb, type: 'bla'},
        {time: 13, func: cb, type: 'bla'}])

      dspObj._schedule('bla', 9, cb)
      assert.deepEqual(dspObj._scheduled, [{time: 1, func: cb, type: 'bla'}, {time: 2, func: cb, type: 'bla'},
        {time: 3, func: cb, type: 'bla'}, {time: 7, func: cb, type: 'bla'}, {time: 9, func: cb, type: 'bla'},
        {time: 11, func: cb, type: 'bla'}, {time: 13, func: cb, type: 'bla'}])

      dspObj._schedule('bla', 2, cb)
      assert.deepEqual(dspObj._scheduled, [{time: 1, func: cb, type: 'bla'}, {time: 2, func: cb, type: 'bla'},
        {time: 2, func: cb, type: 'bla'}, {time: 3, func: cb, type: 'bla'}, {time: 7, func: cb, type: 'bla'},
        {time: 9, func: cb, type: 'bla'}, {time: 11, func: cb, type: 'bla'}, {time: 13, func: cb, type: 'bla'}])
    })

    it('should insert events with same time in reverse order they were added', function() {
      var dspObj = new DspObject(dummyContext)
        , cb = function() {}

      dspObj._schedule('bla', 10, cb)
      assert.deepEqual(dspObj._scheduled, [{time: 10, func: cb, type: 'bla'}])

      dspObj._schedule('blo', 10, cb)
      assert.deepEqual(dspObj._scheduled, [{time: 10, func: cb, type: 'blo'}, {time: 10, func: cb, type: 'bla'}])

      dspObj._schedule('bli', 10, cb)
      assert.deepEqual(dspObj._scheduled, [{time: 10, func: cb, type: 'bli'}, {time: 10, func: cb, type: 'blo'},
        {time: 10, func: cb, type: 'bla'}])

      dspObj._schedule('blu', 10, cb)
      assert.deepEqual(dspObj._scheduled, [{time: 10, func: cb, type: 'blu'}, {time: 10, func: cb, type: 'bli'},
        {time: 10, func: cb, type: 'blo'}, {time: 10, func: cb, type: 'bla'}])
    })

    it('should add args if they are provided', function() {
      var dspObj = new DspObject(dummyContext)
        , cb = function() {}

      dspObj._schedule('bla', 10, cb, [1, 2, 3])
      dspObj._schedule('bla', 16, cb)
      assert.deepEqual(dspObj._scheduled, [
        {time: 10, func: cb, type: 'bla', args: [1, 2, 3]},
        {time: 16, func: cb, type: 'bla'}
      ])
    })

  })

  describe('_tick', function() {

    it('should execute simple events rightly', function() {
      var called = []
        , dspObj = new DspObject(dummyContext)
      dspObj._schedule('a', 9, function() { called.push(1) })
      dspObj._schedule('b', 3.51, function() { called.push(2) })
      dspObj._schedule('c', 2.55, function() { called.push(3) })

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

    it('should take the more recent event of events with same type and same time', function() {
      var called = []
        , dspObj = new DspObject(dummyContext)
      dspObj._schedule('bla', 9, function() { called.push(1) })
      dspObj._schedule('bla', 9, function() { called.push(2) })
      dspObj._schedule('bla', 9.1, function() { called.push(3) })

      dummyContext.currentTime = 9
      dspObj._tick()
      assert.deepEqual(called, [2])
      dummyContext.currentTime = 9.1
      dspObj._tick()
      assert.deepEqual(called, [2, 3])
    })

    it('should execute events with same time in the order they were added', function() {
      var called = []
        , dspObj = new DspObject(dummyContext)
      dspObj._schedule('bla', 9, function() { called.push(1) })
      dspObj._schedule('blo', 9, function() { called.push(2) })
      dspObj._schedule('bli', 9, function() { called.push(3) })
      dspObj._schedule('blu', 9.1, function() { called.push(4) })

      dummyContext.currentTime = 9
      dspObj._tick()
      assert.deepEqual(called, [1, 2, 3])
      dummyContext.currentTime = 9.1
      dspObj._tick()
      assert.deepEqual(called, [1, 2, 3, 4])
    })

  })

  describe('_unscheduleTypes', function() {

    it('should unschedule events of given type', function() {
      var dspObj = new DspObject(dummyContext)
      dspObj._schedule('a', 45)
      dspObj._schedule('b', 78)
      dspObj._schedule('a', 79)
      dspObj._schedule('c', 79.5)
      dspObj._schedule('d', 89)
      assert.deepEqual(dspObj._scheduled, [
        {type: 'a', time: 45, func: undefined}, {type: 'b', time: 78, func: undefined},
        {type: 'a', time: 79, func: undefined}, {type: 'c', time: 79.5, func: undefined},
        {type: 'd', time: 89, func: undefined}
      ])

      dspObj._unscheduleTypes(['a'])
      assert.deepEqual(dspObj._scheduled, [
        {type: 'b', time: 78, func: undefined}, {type: 'c', time: 79.5, func: undefined},
        {type: 'd', time: 89, func: undefined}
      ])

      dspObj._unscheduleTypes(['c', 'd'])
      assert.deepEqual(dspObj._scheduled, [
        {type: 'b', time: 78, func: undefined}
      ])
    })
  })

})
