import test from 'tst'
import { is, ok, throws, almost } from 'tst'
import AudioContext from '../src/AudioContext.js'
import OfflineAudioContext from '../src/OfflineAudioContext.js'
import AudioNode from '../src/AudioNode.js'
import AudioBuffer from 'audio-buffer'
import AudioBufferSourceNode from '../src/AudioBufferSourceNode.js'
import AudioParam from '../src/AudioParam.js'
import GainNode from '../src/GainNode.js'
import OscillatorNode from '../src/OscillatorNode.js'
import DelayNode from '../src/DelayNode.js'
import WaveShaperNode from '../src/WaveShaperNode.js'
import AnalyserNode from '../src/AnalyserNode.js'
import { BLOCK_SIZE } from '../src/constants.js'

let mkCtx = () => new AudioContext()

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
  let ctx = new AudioContext()
  await ctx.close()
  is(ctx.state, 'closed')
})

test('closed context > factory methods throw InvalidStateError', async () => {
  let ctx = new AudioContext()
  await ctx.close()
  throws(() => ctx.createGain())
  throws(() => ctx.createOscillator())
  throws(() => ctx.createBufferSource())
  // createBuffer and createPeriodicWave are allowed on closed contexts
  ok(ctx.createBuffer(1, 128, 44100), 'createBuffer allowed on closed')
  ok(ctx.createPeriodicWave(new Float32Array([0,0]), new Float32Array([0,1])), 'createPeriodicWave allowed on closed')
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

// --- graph cycles with DelayNode ---

test.mute('graph cycle with DelayNode does not stack overflow', async () => {
  let ctx = new OfflineAudioContext(1, 1024, 44100)
  let osc = ctx.createOscillator()
  let gain = ctx.createGain()
  let delay = ctx.createDelay()
  delay.delayTime.value = 128 / 44100

  // osc → gain → destination
  //        ↑       ↓
  //        delay ←──┘ (feedback)
  osc.connect(gain)
  gain.connect(ctx.destination)
  gain.connect(delay) // send to delay
  delay.connect(gain) // feedback into gain

  gain.gain.value = 0.5
  osc.start(0)

  // should not stack overflow
  let buf = await ctx.startRendering()
  ok(buf.length === 1024, 'rendered without stack overflow')
  let d = buf.getChannelData(0)
  ok(d.some(v => Math.abs(v) > 0.01), 'non-silent output from feedback loop')
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

// --- zero-length / short buffers ---

test('AudioBuffer > rejects zero length', () => {
  throws(() => new AudioBuffer(1, 0, 44100))
})

test('AudioBufferSourceNode > handles 1-sample buffer', () => {
  let c = { sampleRate: 44100, currentTime: 0 }
  let src = new AudioBufferSourceNode(c)
  let buf = new AudioBuffer(1, 1, 44100)
  buf.getChannelData(0)[0] = 0.9
  src.buffer = buf
  src.start(0)
  c.currentTime = 0
  let out = src._tick() // start fires + dsp runs in same tick
  almost(out.getChannelData(0)[0], 0.9, 0.01, 'single sample played')
  is(out.getChannelData(0)[1], 0, 'rest is zero')
})

test('WaveShaperNode > rejects length-1 curve', () => {
  let ws = new WaveShaperNode({ sampleRate: 44100, currentTime: 0 })
  throws(() => { ws.curve = new Float32Array(1) })
})

// --- automation event ordering ---

test('AudioParam > overlapping automations: later event wins', () => {
  let c = { sampleRate: 44100, currentTime: 0 }
  let p = new AudioParam(c, 0, 'a')
  p.setValueAtTime(1, 0)
  p.setValueAtTime(5, 0) // same time — should replace
  c.currentTime = 0
  let buf = p._tick()
  is(buf[0], 5, 'later setValue at same time wins')
})

test('AudioParam > cancelScheduledValues clears future, keeps past', () => {
  let c = { sampleRate: 44100, currentTime: 0 }
  let p = new AudioParam(c, 0, 'a')
  p.setValueAtTime(1, 0)
  p.setValueAtTime(10, 1)
  p.setValueAtTime(20, 2)
  p.cancelScheduledValues(1) // remove events at t>=1
  c.currentTime = 2
  let buf = p._tick()
  is(buf[0], 1, 'value stays at 1 after cancel')
})

test('AudioParam > ramp without prior setValue uses current value', () => {
  let c = { sampleRate: 44100, currentTime: 0 }
  let p = new AudioParam(c, 5, 'a')
  // linear ramp from current value (5) to 10 over 1 second
  p.linearRampToValueAtTime(10, 1)
  c.currentTime = 0.5
  let buf = p._tick()
  // at t=0.5, should be roughly midpoint between 5 and 10
  almost(buf[0], 7.5, 1, 'ramp from default value')
})

// --- error type names ---

test('error types > have correct names', async () => {
  let mod = await import('../src/errors.js')
  for (let [name, Cls] of Object.entries(mod)) {
    if (typeof Cls !== 'function' || name === 'setDOMExceptionClass') continue
    let err = new Cls('test')
    is(err.name, name, name + ' has correct .name')
    ok(err.message === 'test', name + ' has message')
  }
})
