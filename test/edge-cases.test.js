import test from 'tst'
import { is, ok, throws, almost } from 'tst'
import AudioContext from '../src/AudioContext.js'
import OfflineAudioContext from '../src/OfflineAudioContext.js'
import AudioNode from '../src/AudioNode.js'
import AudioBuffer from 'audio-buffer'
import GainNode from '../src/GainNode.js'
import OscillatorNode from '../src/OscillatorNode.js'
import DelayNode from '../src/DelayNode.js'
import AnalyserNode from '../src/AnalyserNode.js'
import { BLOCK_SIZE } from '../src/constants.js'

let mkCtx = () => { let c = new AudioContext(); c.outStream = { end() {} }; c[Symbol.dispose](); return c }

// --- connect/disconnect validation ---

test('connect() > throws TypeError for invalid destination', () => {
  let ctx = mkCtx()
  let node = new AudioNode(ctx, 0, 1)
  throws(() => node.connect(null))
  throws(() => node.connect({}))
  throws(() => node.connect(42))
})

test('connect() > throws IndexSizeError for out-of-bounds', () => {
  let ctx = mkCtx()
  let src = new AudioNode(ctx, 0, 1)
  let dest = new AudioNode(ctx, 1, 0)
  throws(() => src.connect(dest, 5))
  throws(() => src.connect(dest, 0, 5))
})

test('disconnect() > throws IndexSizeError for out-of-bounds', () => {
  let ctx = mkCtx()
  let src = new AudioNode(ctx, 0, 1)
  throws(() => src.disconnect(5))
})

// --- start/stop lifecycle ---

test('OscillatorNode > start() twice throws InvalidStateError', () => {
  let ctx = mkCtx()
  let osc = new OscillatorNode(ctx)
  osc.start(0)
  throws(() => osc.start(0))
})

test('OscillatorNode > stop() before start() throws InvalidStateError', () => {
  let ctx = mkCtx()
  let osc = new OscillatorNode(ctx)
  throws(() => osc.stop(0))
})

// --- closed context ---

test('AudioContext > close() sets state to closed', async () => {
  let ctx = mkCtx()
  ctx._state = 'running'
  await ctx.close()
  is(ctx.state, 'closed')
})

test('OfflineAudioContext > startRendering on closed context rejects', async () => {
  let ctx = new OfflineAudioContext(1, 128, 44100)
  await ctx.startRendering()
  try {
    await ctx.startRendering()
    ok(false, 'should have rejected')
  } catch (e) {
    ok(e.message.includes('closed'), 'rejects with closed error')
  }
})

// --- AnalyserNode validation ---

test('AnalyserNode > minDecibels must be < maxDecibels', () => {
  let ctx = mkCtx()
  let a = new AnalyserNode(ctx)
  throws(() => { a.minDecibels = 0 }) // default max is -30
  throws(() => { a.maxDecibels = -200 }) // default min is -100
})

test('AnalyserNode > fftSize must be power of 2', () => {
  let ctx = mkCtx()
  let a = new AnalyserNode(ctx)
  throws(() => { a.fftSize = 100 })
  throws(() => { a.fftSize = 16 })
  a.fftSize = 512
  is(a.fftSize, 512)
})

// --- disconnected nodes ---

test('disconnected processing node outputs silence', () => {
  let ctx = mkCtx()
  let gain = new GainNode(ctx)
  // no input connected — should output silence
  ctx._state = 'running'
  let buf = gain._tick()
  for (let i = 0; i < BLOCK_SIZE; i++) is(buf.getChannelData(0)[i], 0)
})

// --- channel count changes ---

test.mute('GainNode > adapts to channel count changes', () => {
  let ctx = { sampleRate: 44100, currentTime: 0 }
  let gain = new GainNode(ctx)
  let src = new AudioNode(ctx, 0, 1)
  src.connect(gain)

  // mono input
  src._tick = () => AudioBuffer.filledWithVal(1, 1, BLOCK_SIZE, 44100)
  ctx.currentTime = 1
  let buf1 = gain._tick()
  is(buf1.numberOfChannels, 1, 'mono')

  // switch to stereo
  src._tick = () => AudioBuffer.filledWithVal(1, 2, BLOCK_SIZE, 44100)
  ctx.currentTime = 2
  let buf2 = gain._tick()
  is(buf2.numberOfChannels, 2, 'stereo')
})

// --- OfflineAudioContext non-block-aligned length ---

test('OfflineAudioContext > non-block-aligned length renders correctly', async () => {
  let ctx = new OfflineAudioContext(1, 200, 44100) // 200 not multiple of 128
  let buf = await ctx.startRendering()
  is(buf.length, 200)
  almost(ctx.currentTime, 200 / 44100, 1e-6, 'currentTime correct for partial block')
})

// --- error type names ---

test('error types > have correct names', async () => {
  let mod = await import('../src/errors.js')
  for (let [name, Cls] of Object.entries(mod)) {
    let err = new Cls('test')
    is(err.name, name, name + ' has correct .name')
    ok(err.message === 'test', name + ' has message')
  }
})
