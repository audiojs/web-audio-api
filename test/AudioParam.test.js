import test from 'tst'
import { is, ok, throws, almost } from 'tst'
import AudioParam from '../src/AudioParam.js'
import { BLOCK_SIZE } from '../src/constants.js'
import { allEqual, allAlmost, allFunc } from './helpers.js'

const SR = 44100, Ts = 1 / SR

let mkCtx = () => ({ currentTime: 0, sampleRate: SR })

let validBlock = (block) => {
  is(block.length, BLOCK_SIZE)
}

let untilTime = (p, ctx, until, fn) => {
  while (ctx.currentTime < until - 3 * Ts / 2) {
    let block = p._tick()
    fn(block, ctx.currentTime)
    is(p.value, block[BLOCK_SIZE - 1])
    ctx.currentTime += Ts * BLOCK_SIZE
  }
}

test('AudioParam > defaultValue is readonly', () => {
  let ctx = mkCtx()
  let p = new AudioParam(ctx, 98)
  is(p.defaultValue, 98)
  is(p.value, 98)
  throws(() => { p.defaultValue = 77 })
})

test('AudioParam > rejects non-number defaultValue', () => {
  throws(() => new AudioParam(mkCtx(), 'u'))
})

test.mute('AudioParam > outputs constant default value', () => {
  let ctx = mkCtx()
  let p = new AudioParam(ctx, 44)
  let block = p._tick()
  validBlock(block)
  allEqual(block, 44)
})

test.mute('AudioParam > value setter updates output', () => {
  let ctx = mkCtx()
  let p = new AudioParam(ctx, 44)
  p._tick()
  p.value = 99
  let block = p._tick()
  allEqual(block, 99)
})

test.mute('AudioParam > setValueAtTime', () => {
  let ctx = mkCtx()
  let p = new AudioParam(ctx, 6)
  p.setValueAtTime(55, 1)

  untilTime(p, ctx, 1, (block) => {
    validBlock(block)
    allEqual(block, 6)
  })

  ctx.currentTime += Ts
  let block = p._tick()
  allEqual(block, 55)
  is(p.value, 55)
})

test.mute('AudioParam > linearRampToValueAtTime (a-rate)', () => {
  let ctx = mkCtx()
  let p = new AudioParam(ctx, 15, 'a')

  p.linearRampToValueAtTime(25, 1)
  untilTime(p, ctx, 1, (block, Tb) => {
    validBlock(block)
    allFunc(block, Tb, t => Math.min(15 + 10 * t, 25))
  })

  let block = p._tick()
  allEqual(block, 25)
})

test.mute('AudioParam > linearRampToValueAtTime (k-rate)', () => {
  let ctx = mkCtx()
  let p = new AudioParam(ctx, 15, 'k')

  p.linearRampToValueAtTime(25, 1)
  untilTime(p, ctx, 1 - 3 * Ts / 2, (block, Tb) => {
    validBlock(block)
    allAlmost(block, 15 + 10 * Tb)
  })

  let block = p._tick()
  allEqual(block, 25)
})

test.mute('AudioParam > exponentialRampToValueAtTime > rejects zero target', () => {
  let ctx = mkCtx()
  let p = new AudioParam(ctx, 15, 'a')
  throws(() => p.exponentialRampToValueAtTime(0, 1))
  // negative targets are allowed per spec — only zero is forbidden
  p.exponentialRampToValueAtTime(-1, 9) // should not throw
  p.value = -5
  p.exponentialRampToValueAtTime(10, 9) // should not throw
})

test.mute('AudioParam > exponentialRampToValueAtTime (a-rate)', () => {
  let ctx = mkCtx()
  let p = new AudioParam(ctx, 1, 'a')

  p.exponentialRampToValueAtTime(2, 1)
  untilTime(p, ctx, 1, (block, Tb) => {
    validBlock(block)
    allFunc(block, Tb, t => Math.min(Math.pow(2, t), 2))
  })

  let block = p._tick()
  allEqual(block, 2)
})

test.mute('AudioParam > setTargetAtTime (a-rate)', () => {
  let ctx = mkCtx()
  let p = new AudioParam(ctx, 1, 'a')

  ctx.currentTime = 1
  p.setTargetAtTime(2, 1, 0.3)

  // Run enough blocks for convergence (5 time constants ≈ 1.5s)
  while (ctx.currentTime < 3) {
    p._tick()
    ctx.currentTime += Ts * BLOCK_SIZE
  }
  almost(p.value, 2, 0.01, 'converges to target')
})

test.mute('AudioParam > setValueCurveAtTime (a-rate)', () => {
  let ctx = mkCtx()
  let p = new AudioParam(ctx, 1, 'a')

  p.setValueCurveAtTime([1, 2, 3, 4, 5], 0, 12800 * Ts)

  // Run until curve is done
  while (ctx.currentTime < 12800 * Ts + Ts * BLOCK_SIZE) {
    p._tick()
    ctx.currentTime += Ts * BLOCK_SIZE
  }
  is(p.value, 5)
})

test.mute('AudioParam > events sequence: setValue before ramp', () => {
  let ctx = mkCtx()
  let p = new AudioParam(ctx, -1, 'a')

  p.setValueAtTime(0, 2)
  p.linearRampToValueAtTime(1, 3)

  // t=0..2: should be -1
  untilTime(p, ctx, 2, (block) => {
    let end = Math.min(128, Math.round((2 - p.context.currentTime) * SR))
    allEqual(block.subarray(0, end), -1)
  })

  // t=2..3: ramp 0→1
  untilTime(p, ctx, 3, (block, Tb) => {
    validBlock(block)
    allFunc(block, Tb, t => Math.min((t - 2) / (3 - 2), 1))
  })
})

// --- Phase 0 issue tests ---

test('Phase0 > AudioParam > returns reused Float32Array (no alloc per tick)', () => {
  let ctx = mkCtx()
  let p = new AudioParam(ctx, 1)

  let b1 = p._tick()
  let b2 = p._tick()
  ok(b1 instanceof Float32Array, 'returns Float32Array directly')
  ok(b1 === b2, 'same array reused across ticks')
  is(b1.length, BLOCK_SIZE)
})

test.mute('AudioParam > cancelScheduledValues removes future events', () => {
  let ctx = mkCtx()
  let p = new AudioParam(ctx, 0, 'a')
  p.setValueAtTime(1, 1)
  p.setValueAtTime(2, 2)
  p.setValueAtTime(3, 3)
  p.cancelScheduledValues(2)
  // events at t=2 and t=3 should be gone, t=1 remains
  ctx.currentTime = 3
  let block = p._tick()
  is(block[BLOCK_SIZE - 1], 1, 'value stays at 1 after cancelling t>=2')
})

test('AudioParam > cancelAndHoldAtTime holds value', () => {
  let ctx = mkCtx()
  let p = new AudioParam(ctx, 0, 'a')
  p.setValueAtTime(0, 0)
  p.linearRampToValueAtTime(10, 1)
  p.cancelAndHoldAtTime(0.5)
  ctx.currentTime = 1
  let block = p._tick()
  // value should be held at ~5 (midpoint of ramp 0→10 at t=0.5)
  almost(block[BLOCK_SIZE - 1], 5, 0.5, 'held at ramp midpoint')
})
