// Tests for design audit fixes — blocking, high priority, medium issues
import test from 'tst'
import { is, ok, throws, almost } from 'tst'
import AudioContext from '../src/AudioContext.js'
import AudioNode from '../src/AudioNode.js'
import AudioParam from '../src/AudioParam.js'
import AudioBufferSourceNode from '../src/AudioBufferSourceNode.js'
import AudioBuffer from 'audio-buffer'
import { AudioInput, AudioOutput } from '../src/audioports.js'
import { BLOCK_SIZE } from '../src/constants.js'

// --- BLOCKING FIXES ---

test('exports > all public types importable from index.js', async () => {
  let mod = await import('../index.js')
  ok(mod.AudioContext, 'AudioContext')
  ok(mod.AudioParam, 'AudioParam')
  ok(mod.AudioNode, 'AudioNode')
  ok(mod.AudioDestinationNode, 'AudioDestinationNode')
  ok(mod.AudioBuffer, 'AudioBuffer')
  ok(mod.AudioBufferSourceNode, 'AudioBufferSourceNode')
  ok(mod.GainNode, 'GainNode')
  ok(mod.ScriptProcessorNode, 'ScriptProcessorNode')
  ok(mod.PannerNode, 'PannerNode')
  ok(mod.AudioListener, 'AudioListener')
  is(mod.BLOCK_SIZE, 128, 'BLOCK_SIZE')
})

test('exports > no broken default import from constants', async () => {
  let mod = await import('../src/constants.js')
  is(mod.BLOCK_SIZE, 128)
  is(mod.default, undefined, 'no default export')
})

// --- HIGH PRIORITY FIXES ---

test('connect() > returns destination for chaining', () => {
  let ctx = { sampleRate: 44100, currentTime: 0 }
  let a = new AudioNode(ctx, 0, 1)
  let b = new AudioNode(ctx, 1, 1)
  let c = new AudioNode(ctx, 1, 0)

  let result = a.connect(b)
  is(result, b, 'connect returns destination')

  // chaining
  let result2 = a.connect(b).connect(c)
  is(result2, c, 'chaining works')
})

test.mute('disconnect(destination) > disconnects specific destination', () => {
  let ctx = { sampleRate: 44100, currentTime: 0 }
  let src = new AudioNode(ctx, 0, 1)
  let dest1 = new AudioNode(ctx, 1, 0)
  let dest2 = new AudioNode(ctx, 1, 0)

  src.connect(dest1)
  src.connect(dest2)
  is(src._outputs[0].sinks.length, 2)

  src.disconnect(dest1)
  is(src._outputs[0].sinks.length, 1, 'only dest1 disconnected')
  ok(src._outputs[0].sinks[0] === dest2._inputs[0], 'dest2 still connected')
})

test.mute('disconnect() > disconnects all outputs', () => {
  let ctx = { sampleRate: 44100, currentTime: 0 }
  let src = new AudioNode(ctx, 0, 3)
  let s1 = new AudioNode(ctx, 1, 0)
  let s2 = new AudioNode(ctx, 1, 0)

  src.connect(s1, 0)
  src.connect(s2, 1)
  src.connect(s2, 2)

  src.disconnect()
  is(src._outputs[0].sinks.length, 0)
  is(src._outputs[1].sinks.length, 0)
  is(src._outputs[2].sinks.length, 0)
})

test('disconnect(dest, output, input) > precise disconnection', () => {
  let ctx = { sampleRate: 44100, currentTime: 0 }
  let src = new AudioNode(ctx, 0, 2)
  let dest = new AudioNode(ctx, 2, 0)

  src.connect(dest, 0, 0)
  src.connect(dest, 1, 1)
  is(src._outputs[0].sinks.length, 1)
  is(src._outputs[1].sinks.length, 1)

  src.disconnect(dest, 0, 0)
  is(src._outputs[0].sinks.length, 0, 'output 0→input 0 disconnected')
  is(src._outputs[1].sinks.length, 1, 'output 1→input 1 still connected')
})

test('once() > fires once without nuking other listeners', () => {
  let ctx = { sampleRate: 44100 }
  let node = {}
  let output = new AudioOutput(ctx, node, 0)
  let calls = { a: 0, b: 0, c: 0 }

  output.on('test', () => calls.a++)
  output.once('test', () => calls.b++)
  output.on('test', () => calls.c++)

  output.emit('test')
  is(calls.a, 1)
  is(calls.b, 1)
  is(calls.c, 1)

  output.emit('test')
  is(calls.a, 2, 'permanent listener still fires')
  is(calls.b, 1, 'once listener only fired once')
  is(calls.c, 2, 'other permanent listener still fires')
})

test('listener cleanup > disconnect only removes own handler', () => {
  let ctx = { sampleRate: 44100 }
  let node1 = { channelCount: 2, channelCountMode: 'max', channelInterpretation: 'discrete' }
  let node2 = { channelCount: 2, channelCountMode: 'max', channelInterpretation: 'discrete' }
  let output = new AudioOutput(ctx, {}, 0)
  let input1 = new AudioInput(ctx, node1, 0)
  let input2 = new AudioInput(ctx, node2, 0)

  input1.connect(output)
  input2.connect(output)
  is(output.listenerCount('_numberOfChannels'), 2, 'both handlers registered')

  input1.disconnect(output)
  is(output.listenerCount('_numberOfChannels'), 1, 'only input1 handler removed')

  input2.disconnect(output)
  is(output.listenerCount('_numberOfChannels'), 0, 'all cleaned up')
})

test('listener cleanup > fan-out beyond 10 connections emits no warning', () => {
  let ctx = { sampleRate: 44100 }
  let output = new AudioOutput(ctx, {}, 0)
  let inputs = Array.from({ length: 16 }, () =>
    new AudioInput(ctx, { channelCount: 1, channelCountMode: 'max', channelInterpretation: 'discrete' }, 0))

  // connect 16 inputs to same output — must not trigger MaxListenersExceededWarning
  let warned = false
  let onWarn = (w) => { if (w.name === 'MaxListenersExceededWarning') warned = true }
  process.on('warning', onWarn)
  for (let inp of inputs) inp.connect(output)
  is(output.listenerCount('_numberOfChannels'), 16, '16 listeners registered')
  ok(!warned, 'no MaxListenersExceededWarning')

  // cleanup
  for (let inp of inputs) inp.disconnect(output)
  is(output.listenerCount('_numberOfChannels'), 0, 'all cleaned up after disconnect')
  process.off('warning', onWarn)
})

test.mute('cancelScheduledValues > removes future events', () => {
  let ctx = { currentTime: 0, sampleRate: 44100 }
  let p = new AudioParam(ctx, 0, 'a')
  p.setValueAtTime(1, 1)
  p.setValueAtTime(5, 2)
  p.setValueAtTime(10, 3)

  p.cancelScheduledValues(2)
  ctx.currentTime = 4
  let buf = p._tick()
  is(buf[BLOCK_SIZE - 1], 1, 'only event at t=1 remains')
})

test('cancelAndHoldAtTime > freezes at interpolated value', () => {
  let ctx = { currentTime: 0, sampleRate: 44100 }
  let p = new AudioParam(ctx, 0, 'a')
  p.setValueAtTime(0, 0)
  p.linearRampToValueAtTime(10, 1)
  p.cancelAndHoldAtTime(0.5)

  ctx.currentTime = 2
  let buf = p._tick()
  almost(buf[BLOCK_SIZE - 1], 5, 0.5, 'held near ramp midpoint')
})

// --- MEDIUM FIXES ---

test('onended > fires as event, settable as property', () => {
  let ctx = { sampleRate: 44100, currentTime: 0 }
  let node = new AudioBufferSourceNode(ctx)
  let ended = 0

  // set via property
  node.onended = () => ended++
  ok(typeof node.onended === 'function', 'getter returns function')

  // also works via addEventListener
  node.addEventListener('ended', () => ended++)

  // simulate ended event
  node.dispatchEvent(new Event('ended'))
  is(ended, 2, 'both property and addEventListener handlers fire')

  // replace handler
  node.onended = () => ended += 10
  node.dispatchEvent(new Event('ended'))
  is(ended, 13, 'old handler replaced, addEventListener still fires')
})

test('onended > null clears handler', () => {
  let ctx = { sampleRate: 44100, currentTime: 0 }
  let node = new AudioBufferSourceNode(ctx)
  let called = false

  node.onended = () => { called = true }
  node.onended = null
  node.dispatchEvent(new Event('ended'))
  ok(!called, 'cleared handler does not fire')
})

test('enum setters > silently ignore invalid values per spec', () => {
  let ctx = { sampleRate: 44100, currentTime: 0 }
  let node = new AudioNode(ctx, 1, 1)
  node.channelCountMode = 'max'
  node.channelCountMode = 'bad'
  is(node.channelCountMode, 'max', 'channelCountMode unchanged')
})

test('AudioContext > onstatechange as event handler property', async () => {
  let ctx = new AudioContext()
  ctx.outStream = { end() {} }
  let states = []

  // set via property
  ctx.onstatechange = () => states.push(ctx.state)
  ok(typeof ctx.onstatechange === 'function')

  // initial state is now 'suspended' per spec
  await ctx.resume()
  await ctx.suspend()

  // replace handler
  ctx.onstatechange = () => states.push('!' + ctx.state)
  await ctx.close()

  is(states, ['running', 'suspended', '!closed'])
})
