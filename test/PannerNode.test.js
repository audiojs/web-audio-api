import test from 'tst'
import { is, ok, throws, almost } from 'tst'
import PannerNode from '../src/PannerNode/index.js'
import AudioNode from '../src/AudioNode.js'
import AudioBuffer from 'audio-buffer'
import AudioContext from '../src/AudioContext.js'
import { BLOCK_SIZE } from '../src/constants.js'
import DistanceEffect from '../src/PannerNode/DistanceEffect.js'
import ConeEffect from '../src/PannerNode/ConeEffect.js'
import EqualPowerPanner from '../src/PannerNode/EqualPowerPanner.js'
import Panner from '../src/PannerNode/Panner.js'
import PannerProvider from '../src/PannerNode/PannerProvider.js'
import FloatPoint3D from '../src/FloatPoint3D.js'
import { allAlmost } from './helpers.js'

// --- DistanceEffect ---

test('DistanceEffect > inverse model', () => {
  let d = new DistanceEffect()
  d.setModel('inverse', true)
  let g = d.gain(10)
  ok(g > 0 && g <= 1, 'gain in valid range')
})

test('DistanceEffect > linear model', () => {
  let d = new DistanceEffect()
  d.setModel('linear', true)
  let g = d.gain(5)
  ok(g >= 0 && g <= 1, 'gain in valid range')
})

test('DistanceEffect > exponential model', () => {
  let d = new DistanceEffect()
  d.setModel('exponential', true)
  let g = d.gain(10)
  ok(g > 0, 'positive gain')
})

// --- ConeEffect ---

test('ConeEffect > gain within inner cone is 1', () => {
  let c = new ConeEffect()
  c.innerAngle = 90
  c.outerAngle = 180
  c.outerGain = 0
  // source at origin looking at listener — listener directly in front
  let g = c.gain(
    new FloatPoint3D(0, 0, 0),
    new FloatPoint3D(0, 0, 1),
    new FloatPoint3D(0, 0, 5)
  )
  almost(g, 1, 1e-6)
})

// --- Panner ---

test('Panner > base class pan() throws', () => {
  let p = new Panner()
  throws(() => p.pan())
})

// --- PannerProvider ---

test('PannerProvider > creates equalpower panner', () => {
  let ctx = new AudioContext()
  ctx.outStream = { end() {} }
  ctx[Symbol.dispose]()
  let pp = new PannerProvider(ctx)
  pp.panningModel = 'equalpower'
  ok(pp.panner instanceof EqualPowerPanner)
})

test('PannerProvider > rejects HRTF', () => {
  let ctx = new AudioContext()
  ctx.outStream = { end() {} }
  ctx[Symbol.dispose]()
  let pp = new PannerProvider(ctx)
  throws(() => { pp.panningModel = 'HRTF' })
})

// --- PannerNode ---

test('PannerNode > constructor defaults', () => {
  let ctx = new AudioContext()
  ctx.outStream = { end() {} }
  ctx[Symbol.dispose]()

  let p = new PannerNode(ctx)
  is(p.channelCount, 2)
  is(p.channelCountMode, 'clamped-max')
  is(p.distanceModel, 'inverse')
  is(p.panningModel, 'equalpower')
  almost(p.refDistance, 1, 1e-6)
  almost(p.coneInnerAngle, 360, 1e-6)
  almost(p.coneOuterAngle, 360, 1e-6)
})

test('PannerNode > channelCount restricted to 1 or 2', () => {
  let ctx = new AudioContext()
  ctx.outStream = { end() {} }
  ctx[Symbol.dispose]()

  let p = new PannerNode(ctx)
  p.channelCount = 1
  is(p.channelCount, 1)
  p.channelCount = 2
  is(p.channelCount, 2)
  throws(() => { p.channelCount = 3 })
})

test('PannerNode > channelCountMode rejects max', () => {
  let ctx = new AudioContext()
  ctx.outStream = { end() {} }
  ctx[Symbol.dispose]()

  let p = new PannerNode(ctx)
  throws(() => { p.channelCountMode = 'max' })
})

test('PannerNode > setPosition validates args', () => {
  let ctx = new AudioContext()
  ctx.outStream = { end() {} }
  ctx[Symbol.dispose]()

  let p = new PannerNode(ctx)
  p.setPosition(1, 2, 3)
  throws(() => p.setPosition(1, 2))
  throws(() => p.setPosition(NaN, 0, 0))
})

test('PannerNode > _tick outputs stereo', () => {
  let ctx = new AudioContext()
  ctx.outStream = { end() {} }
  ctx[Symbol.dispose]()

  let p = new PannerNode(ctx)
  let src = new AudioNode(ctx, 0, 1)
  src.connect(p)
  src._tick = () => AudioBuffer.filledWithVal(0.5, 1, BLOCK_SIZE, 44100)

  let block = p._tick()
  is(block.numberOfChannels, 2)
  is(block.length, BLOCK_SIZE)
})
