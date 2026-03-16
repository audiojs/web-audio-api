import test from 'tst'
import { is, ok, throws } from 'tst'
import DspObject from '../src/DspObject.js'

// --- migrated from DspObject-test.js ---

test('DspObject > _schedule > keeps events sorted by time', () => {
  let ctx = { currentTime: 0 }
  let obj = new DspObject(ctx)
  let cb = () => {}

  obj._scheduled = [
    { time: 2, func: cb, type: 'a' }, { time: 3, func: cb, type: 'a' },
    { time: 7, func: cb, type: 'a' }, { time: 11, func: cb, type: 'a' }
  ]

  obj._schedule('a', 1, cb)
  is(obj._scheduled.map(e => e.time), [1, 2, 3, 7, 11])

  obj._schedule('a', 13, cb)
  is(obj._scheduled.map(e => e.time), [1, 2, 3, 7, 11, 13])

  obj._schedule('a', 9, cb)
  is(obj._scheduled.map(e => e.time), [1, 2, 3, 7, 9, 11, 13])

  obj._schedule('a', 2, cb)
  is(obj._scheduled.map(e => e.time), [1, 2, 2, 3, 7, 9, 11, 13])
})

test('DspObject > _schedule > same-time events insert in reverse order', () => {
  let ctx = { currentTime: 0 }
  let obj = new DspObject(ctx)
  let cb = () => {}

  obj._schedule('a', 10, cb)
  obj._schedule('b', 10, cb)
  obj._schedule('c', 10, cb)
  is(obj._scheduled.map(e => e.type), ['c', 'b', 'a'])
})

test('DspObject > _schedule > stores args when provided', () => {
  let ctx = { currentTime: 0 }
  let obj = new DspObject(ctx)
  let cb = () => {}

  obj._schedule('a', 10, cb, [1, 2, 3])
  obj._schedule('a', 16, cb)
  is(obj._scheduled[0].args, [1, 2, 3])
  is(obj._scheduled[1].args, undefined)
})

test('DspObject > _tick > executes events at correct times', () => {
  let ctx = { currentTime: 0 }
  let obj = new DspObject(ctx)
  let called = []

  obj._schedule('a', 9, () => called.push(1))
  obj._schedule('b', 3.51, () => called.push(2))
  obj._schedule('c', 2.55, () => called.push(3))

  obj._tick()
  is(called, [])

  ctx.currentTime = 2.56
  obj._tick()
  is(called, [3])

  ctx.currentTime = 4
  obj._tick()
  is(called, [3, 2])

  ctx.currentTime = 6
  obj._tick()
  is(called, [3, 2])

  ctx.currentTime = 9
  obj._tick()
  is(called, [3, 2, 1])
  is(obj._scheduled.length, 0)
})

test('DspObject > _tick > deduplicates same-type same-time events (keeps latest)', () => {
  let ctx = { currentTime: 0 }
  let obj = new DspObject(ctx)
  let called = []

  obj._schedule('a', 9, () => called.push(1))
  obj._schedule('a', 9, () => called.push(2))
  obj._schedule('a', 9.1, () => called.push(3))

  ctx.currentTime = 9
  obj._tick()
  is(called, [2])

  ctx.currentTime = 9.1
  obj._tick()
  is(called, [2, 3])
})

test('DspObject > _tick > executes different-type same-time events in insertion order', () => {
  let ctx = { currentTime: 0 }
  let obj = new DspObject(ctx)
  let called = []

  obj._schedule('a', 9, () => called.push(1))
  obj._schedule('b', 9, () => called.push(2))
  obj._schedule('c', 9, () => called.push(3))

  ctx.currentTime = 9
  obj._tick()
  is(called, [1, 2, 3])
})

test('DspObject > _unscheduleTypes > removes events by type', () => {
  let ctx = { currentTime: 0 }
  let obj = new DspObject(ctx)

  obj._schedule('a', 45)
  obj._schedule('b', 78)
  obj._schedule('a', 79)
  obj._schedule('c', 79.5)
  obj._schedule('d', 89)

  obj._unscheduleTypes(['a'])
  is(obj._scheduled.map(e => e.type), ['b', 'c', 'd'])

  obj._unscheduleTypes(['c', 'd'])
  is(obj._scheduled.map(e => e.type), ['b'])
})

// --- Phase 0 issue tests ---

test('Phase0 > DspObject > _tick ignores arguments (no arguments needed)', () => {
  // Issue #9: super._tick(arguments) passes arguments that are never used
  let ctx = { currentTime: 0 }
  let obj = new DspObject(ctx)
  let called = false
  obj._schedule('a', 0, () => { called = true })

  // Should work fine without arguments
  obj._tick()
  ok(called, 'event executed without arguments')
})

test('Phase0 > DspObject > _loadDSP removed (was dead code)', () => {
  let ctx = { currentTime: 0 }
  let obj = new DspObject(ctx)
  is(typeof obj._loadDSP, 'undefined', '_loadDSP removed')
})
