import test from 'tst'
import { is, ok, almost, throws, rejects } from 'tst'
import AudioContext from '../src/AudioContext.js'
import BaseAudioContext from '../src/BaseAudioContext.js'
import OfflineAudioContext from '../src/OfflineAudioContext.js'
import OscillatorNode from '../src/OscillatorNode.js'
import GainNode from '../src/GainNode.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from '../src/constants.js'

// --- BaseAudioContext ---

test('BaseAudioContext > AudioContext extends it', () => {
  let ctx = new AudioContext()
  ctx.outStream = { end() {} }; ctx[Symbol.dispose]()
  ok(ctx instanceof BaseAudioContext, 'AudioContext is BaseAudioContext')
})

test('BaseAudioContext > OfflineAudioContext extends it', () => {
  let ctx = new OfflineAudioContext(1, 44100, 44100)
  ok(ctx instanceof BaseAudioContext, 'OfflineAudioContext is BaseAudioContext')
})

test('BaseAudioContext > factory methods available on both', () => {
  let ctx = new OfflineAudioContext(1, 128, 44100)
  ok(ctx.createGain(), 'createGain')
  ok(ctx.createOscillator(), 'createOscillator')
  ok(ctx.createBufferSource(), 'createBufferSource')
  ok(ctx.createBiquadFilter(), 'createBiquadFilter')
  ok(ctx.createAnalyser(), 'createAnalyser')
})

// --- OfflineAudioContext ---

test('OfflineAudioContext > constructor', () => {
  let ctx = new OfflineAudioContext(2, 44100, 44100)
  is(ctx.sampleRate, 44100)
  is(ctx.length, 44100)
  is(ctx.state, 'suspended')
})

test('OfflineAudioContext > renders silence', async () => {
  let ctx = new OfflineAudioContext(1, 256, 44100)
  let buf = await ctx.startRendering()
  is(buf.numberOfChannels, 1)
  is(buf.length, 256)
  is(buf.sampleRate, 44100)
  // no nodes connected — should be silence
  for (let i = 0; i < 256; i++) is(buf.getChannelData(0)[i], 0)
  is(ctx.state, 'closed')
})

test.mute('OfflineAudioContext > renders oscillator', async () => {
  let ctx = new OfflineAudioContext(1, 44100, 44100)
  let osc = ctx.createOscillator()
  osc.frequency.value = 440
  osc.connect(ctx.destination)
  osc.start(0)

  let buf = await ctx.startRendering()
  is(buf.numberOfChannels, 1)
  is(buf.length, 44100)

  // verify non-silent output
  let d = buf.getChannelData(0)
  let max = 0
  for (let i = 0; i < d.length; i++) max = Math.max(max, Math.abs(d[i]))
  ok(max > 0.5, `oscillator peak: ${max.toFixed(3)}`)

  // verify ~440Hz: count zero crossings
  let crossings = 0
  for (let i = 1; i < d.length; i++) if (d[i - 1] * d[i] < 0) crossings++
  // 440Hz × 2 crossings/cycle = 880 crossings/sec
  almost(crossings, 880, 50, `zero crossings: ${crossings}`)
})

test.mute('OfflineAudioContext > renders gain reduction', async () => {
  let ctx = new OfflineAudioContext(1, 1024, 44100)
  let osc = ctx.createOscillator()
  let gain = ctx.createGain()
  osc.frequency.value = 440
  gain.gain.value = 0.25
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(0)

  let buf = await ctx.startRendering()
  let d = buf.getChannelData(0)
  let max = 0
  for (let i = 0; i < d.length; i++) max = Math.max(max, Math.abs(d[i]))
  ok(max > 0.1 && max <= 0.3, `gain-reduced peak: ${max.toFixed(3)}`)
})

test('OfflineAudioContext > oncomplete fires', async () => {
  let ctx = new OfflineAudioContext(1, 128, 44100)
  let completed = false
  ctx.oncomplete = (e) => { completed = true }
  await ctx.startRendering()
  ok(completed, 'oncomplete fired')
})

test('OfflineAudioContext > currentTime advances', async () => {
  let ctx = new OfflineAudioContext(1, 44100, 44100)
  await ctx.startRendering()
  almost(ctx.currentTime, 1.0, 0.01, 'currentTime ≈ 1s after rendering 44100 samples')
})

test('OfflineAudioContext > stereo rendering', async () => {
  let ctx = new OfflineAudioContext(2, 256, 44100)
  let buf = await ctx.startRendering()
  is(buf.numberOfChannels, 2)
  is(buf.length, 256)
})

test('OfflineAudioContext > renderedBuffer available after rendering', async () => {
  let ctx = new OfflineAudioContext(1, 128, 44100)
  is(ctx.renderedBuffer, null)
  let buf = await ctx.startRendering()
  is(ctx.renderedBuffer, buf)
})
