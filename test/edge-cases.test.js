import test from 'tst'
import { is, ok, throws, almost } from 'tst'
import AudioContext from '../src/AudioContext.js'
import OfflineAudioContext from '../src/OfflineAudioContext.js'
import AudioNode from '../src/AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { fill } from 'audio-buffer/util'
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

test('closed context > node creation allowed on closed contexts (per spec)', async () => {
  let ctx = new AudioContext()
  await ctx.close()
  // Per W3C spec, creating nodes on closed contexts is allowed
  ok(ctx.createGain(), 'createGain allowed on closed')
  ok(ctx.createOscillator(), 'createOscillator allowed on closed')
  ok(ctx.createBufferSource(), 'createBufferSource allowed on closed')
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
  src._tick = () => fill(new AudioBuffer(1, BLOCK_SIZE, 44100), 1)
  ctx.currentTime = 1
  let buf1 = gain._tick()
  is(buf1.numberOfChannels, 1, 'mono')

  // switch to stereo
  src._tick = () => fill(new AudioBuffer(2, BLOCK_SIZE, 44100), 1)
  ctx.currentTime = 2
  let buf2 = gain._tick()
  is(buf2.numberOfChannels, 2, 'stereo')
})

// --- OfflineAudioContext non-block-aligned length ---

test('OfflineAudioContext > non-block-aligned length renders correctly', async () => {
  let ctx = new OfflineAudioContext(1, 200, 44100) // 200 not multiple of 128
  let buf = await ctx.startRendering()
  is(buf.length, 200)
  // currentTime advances in full render quanta (128 frames)
  almost(ctx.currentTime, Math.ceil(200 / 128) * 128 / 44100, 1e-6, 'currentTime correct for partial block')
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
    if (typeof Cls !== 'function' || !name.endsWith('Error')) continue
    let err = new Cls('test')
    is(err.name, name, name + ' has correct .name')
    ok(err.message === 'test', name + ' has message')
  }
})

// --- sleep horizons: scheduled-but-idle subgraphs cost nothing and stay exact ---

test('sleep horizons > gain and filter chains wake exactly at the source start time', async () => {
  let sr = 44100, length = 4096, startTime = 2048.5 / sr
  let ctx = new OfflineAudioContext(1, length, sr)
  let osc = ctx.createOscillator()
  let gain = ctx.createGain()
  let filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 20000
  osc.connect(gain).connect(filter).connect(ctx.destination)
  osc.start(startTime)
  let data = (await ctx.startRendering()).getChannelData(0)
  let firstSample = Math.ceil(startTime * sr)
  for (let i = 0; i < firstSample; i++) if (data[i] !== 0) throw new Error(`sample ${i} nonzero before start`)
  ok(data.slice(firstSample).some(Boolean), 'signal present from the start sample on')
})

test('sleep horizons > param.value stays timeline-exact while its node sleeps', async () => {
  let sr = 44100
  let ctx = new OfflineAudioContext(1, 2048, sr)
  let osc = ctx.createOscillator()
  let gain = ctx.createGain()
  osc.connect(gain).connect(ctx.destination)
  osc.start(1) // beyond this render: gain sleeps the whole time
  gain.gain.setValueAtTime(0.2, 0)
  gain.gain.linearRampToValueAtTime(1, 2048 / sr)
  await ctx.startRendering()
  almost(gain.gain.value, 1, 0.01, 'value follows the automation timeline during sleep')
})

test('sleep horizons > connect and start wake a subgraph with a cached horizon', async () => {
  let sr = 44100
  let ctx = new OfflineAudioContext(1, 4096, sr)
  let gain = ctx.createGain()
  gain.connect(ctx.destination)
  let osc = ctx.createOscillator()
  osc.connect(gain)
  // nothing started: the graph sleeps with cached horizons from the first quanta
  ctx.suspend(1024 / sr).then(() => {
    osc.start(2048 / sr)
    ctx.resume()
  })
  let data = (await ctx.startRendering()).getChannelData(0)
  for (let i = 0; i < 2048; i++) if (data[i] !== 0) throw new Error(`sample ${i} nonzero before start`)
  ok(data.slice(2048).some(Boolean), 'signal flows after a start() issued mid-render')
})

test('sleep horizons > connecting a source wakes a chain sleeping on an empty input', async () => {
  let sr = 44100
  let ctx = new OfflineAudioContext(1, 4096, sr)
  let gain = ctx.createGain()
  gain.connect(ctx.destination)
  // gain has no sources: it sleeps forever until a connection arrives
  let osc = ctx.createOscillator()
  osc.start(0)
  ctx.suspend(1024 / sr).then(() => {
    osc.connect(gain)
    ctx.resume()
  })
  let data = (await ctx.startRendering()).getChannelData(0)
  for (let i = 0; i < 1024; i++) if (data[i] !== 0) throw new Error(`sample ${i} nonzero before connect`)
  ok(data.slice(1024).some(Boolean), 'signal flows after a connect() into a sleeping chain')
})

test('sleep horizons > stop before start stays silent and still fires ended', async () => {
  let sr = 44100
  let ctx = new OfflineAudioContext(1, 4096, sr)
  let gain = ctx.createGain()
  gain.connect(ctx.destination)
  let osc = ctx.createOscillator()
  osc.connect(gain)
  osc.start(2048 / sr)
  osc.stop(1024 / sr)
  let ended = new Promise(resolve => { osc.onended = () => resolve(true) })
  let data = (await ctx.startRendering()).getChannelData(0)
  ok(data.every(sample => sample === 0), 'no output when stopped before start')
  ok(await ended, 'ended event fires through the sleeping chain')
})

test('sleep horizons > render cost is flat in the amount of scheduled-ahead work', async () => {
  let render = async duration => {
    let ctx = new OfflineAudioContext(1, 44100, 44100)
    let master = ctx.createGain()
    master.connect(ctx.destination)
    for (let i = 0; i < duration * 4; i++) {
      let osc = ctx.createOscillator()
      let envelope = ctx.createGain()
      envelope.gain.setValueAtTime(0.01, i * 0.25)
      envelope.gain.exponentialRampToValueAtTime(0.001, i * 0.25 + 0.02)
      osc.connect(envelope).connect(master)
      osc.start(i * 0.25)
      osc.stop(i * 0.25 + 0.02)
    }
    let started = performance.now()
    let data = (await ctx.startRendering()).getChannelData(0)
    ok(data.some(Boolean), `audible at ${duration}s of schedule`)
    return performance.now() - started
  }
  await render(30) // warmup
  let small = await render(30)
  let large = await render(600)
  ok(large < Math.max(50, small * 12), `600s schedule renders in ${large.toFixed(0)}ms vs ${small.toFixed(0)}ms for 30s`)
})

test('oscillator started mid-block begins at phase zero without a pop', async () => {
  let sr = 44100
  let ctx = new OfflineAudioContext(1, 1024, sr)
  let osc = new OscillatorNode(ctx)
  osc.frequency.value = 660
  osc.connect(ctx.destination)
  osc.start(300.5 / sr)
  let data = (await ctx.startRendering()).getChannelData(0)
  almost(data[301], 0, 1e-3, 'first audible sample sits at the zero crossing')
  let maxStep = 0
  for (let i = 1; i < data.length; i++) maxStep = Math.max(maxStep, Math.abs(data[i] - data[i - 1]))
  ok(maxStep < 0.12, `steepest step ${maxStep.toFixed(3)} stays within a 660 Hz sine slope`)
})
