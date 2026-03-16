import test from 'tst'
import { is, ok, throws, almost } from 'tst'
import AudioParam from '../src/AudioParam.js'
import { BLOCK_SIZE } from '../src/constants.js'
import { allEqual, allAlmost, allFunc } from './helpers.js'

const SR = 44100, Ts = 1 / SR

let mkCtx = () => ({ currentTime: 0, sampleRate: SR })

let validBlock = (block) => {
  is(block.length, BLOCK_SIZE)
  is(block.numberOfChannels, 1)
}

let untilTime = (p, ctx, until, fn) => {
  while (ctx.currentTime < until - 3 * Ts / 2) {
    let block = p._tick()
    fn(block, ctx.currentTime)
    is(p.value, block.getChannelData(0)[BLOCK_SIZE - 1])
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

test('AudioParam > outputs constant default value', () => {
  let ctx = mkCtx()
  let p = new AudioParam(ctx, 44)
  let block = p._tick()
  validBlock(block)
  allEqual(block.getChannelData(0), 44)
})

test('AudioParam > value setter updates output', () => {
  let ctx = mkCtx()
  let p = new AudioParam(ctx, 44)
  p._tick()
  p.value = 99
  let block = p._tick()
  allEqual(block.getChannelData(0), 99)
})

test('AudioParam > setValueAtTime', () => {
  let ctx = mkCtx()
  let p = new AudioParam(ctx, 6)
  p.setValueAtTime(55, 1)

  untilTime(p, ctx, 1, (block) => {
    validBlock(block)
    allEqual(block.getChannelData(0), 6)
  })

  ctx.currentTime += Ts
  let block = p._tick()
  allEqual(block.getChannelData(0), 55)
  is(p.value, 55)
})

test('AudioParam > linearRampToValueAtTime (a-rate)', () => {
  let ctx = mkCtx()
  let p = new AudioParam(ctx, 15, 'a')

  p.linearRampToValueAtTime(25, 1)
  untilTime(p, ctx, 1, (block, Tb) => {
    validBlock(block)
    allFunc(block.getChannelData(0), Tb, t => Math.min(15 + 10 * t, 25))
  })

  let block = p._tick()
  allEqual(block.getChannelData(0), 25)
})

test('AudioParam > linearRampToValueAtTime (k-rate)', () => {
  let ctx = mkCtx()
  let p = new AudioParam(ctx, 15, 'k')

  p.linearRampToValueAtTime(25, 1)
  untilTime(p, ctx, 1 - 3 * Ts / 2, (block, Tb) => {
    validBlock(block)
    allAlmost(block.getChannelData(0), 15 + 10 * Tb)
  })

  let block = p._tick()
  allEqual(block.getChannelData(0), 25)
})

test('AudioParam > exponentialRampToValueAtTime > rejects non-positive values', () => {
  let ctx = mkCtx()
  let p = new AudioParam(ctx, 15, 'a')
  throws(() => p.exponentialRampToValueAtTime(-1, 9))
  throws(() => p.exponentialRampToValueAtTime(0, 1))
  p.value = -5
  throws(() => p.exponentialRampToValueAtTime(10, 9))
})

test('AudioParam > exponentialRampToValueAtTime (a-rate)', () => {
  let ctx = mkCtx()
  let p = new AudioParam(ctx, 1, 'a')

  p.exponentialRampToValueAtTime(2, 1)
  untilTime(p, ctx, 1, (block, Tb) => {
    validBlock(block)
    allFunc(block.getChannelData(0), Tb, t => Math.min(Math.pow(2, t), 2))
  })

  let block = p._tick()
  allEqual(block.getChannelData(0), 2)
})

test('AudioParam > setTargetAtTime (a-rate)', () => {
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

test('AudioParam > setValueCurveAtTime (a-rate)', () => {
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

test('AudioParam > events sequence: setValue before ramp', () => {
  let ctx = mkCtx()
  let p = new AudioParam(ctx, -1, 'a')

  p.setValueAtTime(0, 2)
  p.linearRampToValueAtTime(1, 3)

  // t=0..2: should be -1
  untilTime(p, ctx, 2, (block) => {
    let end = Math.min(128, Math.round((2 - p.context.currentTime) * SR))
    allEqual(block.getChannelData(0).subarray(0, end), -1)
  })

  // t=2..3: ramp 0→1
  untilTime(p, ctx, 3, (block, Tb) => {
    validBlock(block)
    allFunc(block.getChannelData(0), Tb, t => Math.min((t - 2) / (3 - 2), 1))
  })
})

// --- Phase 0 issue tests ---

test('Phase0 > AudioParam > allocates AudioBuffer per _tick (perf issue)', () => {
  // Issue #7: AudioParam._tick() creates new AudioBuffer(1, BLOCK_SIZE, sampleRate)
  // every call. Should return Float32Array directly.
  let ctx = mkCtx()
  let p = new AudioParam(ctx, 1)

  let b1 = p._tick()
  let b2 = p._tick()
  // Currently these are different objects (new AudioBuffer each time)
  ok(b1 !== b2, 'creates new AudioBuffer per tick (perf issue to fix)')
  is(b1.numberOfChannels, 1)
  is(b1.length, BLOCK_SIZE)
})

test('Phase0 > AudioParam > cancelScheduledValues not implemented', () => {
  let ctx = mkCtx()
  let p = new AudioParam(ctx, 1)
  throws(() => p.cancelScheduledValues(0), /implement me/)
})
