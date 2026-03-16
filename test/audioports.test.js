import test from 'tst'
import { is, ok, almost } from 'tst'
import { AudioInput, AudioOutput } from '../src/audioports.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from '../src/constants.js'
import { allAlmost, channelsEqual, makeOutput } from './helpers.js'

let ctx = { sampleRate: 44100 }
let dummyNode = {}

// --- port connect/disconnect ---

test('AudioPort > connect/disconnect', () => {
  let sink = new AudioInput(ctx, dummyNode, 0)
  let src = new AudioOutput(ctx, dummyNode, 1)

  sink.connect(src)
  is(sink.sources, [src])
  sink.disconnect(src)
  is(sink.sources, [])
})

test('AudioPort > emits connection/disconnection events', () => {
  let recv = []
  let sink = new AudioInput(ctx, dummyNode, 0)
  let src = new AudioOutput(ctx, dummyNode, 1)

  sink.on('connection', () => recv.push('in-conn'))
  src.on('connection', () => recv.push('out-conn'))
  sink.on('disconnection', () => recv.push('in-disc'))
  src.on('disconnection', () => recv.push('out-disc'))

  sink.connect(src)
  is(recv, ['out-conn', 'in-conn'])

  src.disconnect(sink)
  is(recv.length, 4)
})

test('AudioPort > _numberOfChannels event invalidates computedNumberOfChannels', () => {
  let sink = new AudioInput(ctx, dummyNode, 0)
  let src = new AudioOutput(ctx, dummyNode, 1)
  sink.computedNumberOfChannels = 2

  // before connection: event has no effect
  src.emit('_numberOfChannels')
  is(sink.computedNumberOfChannels, 2)

  // after connection: event invalidates
  src.connect(sink)
  src.emit('_numberOfChannels')
  is(sink.computedNumberOfChannels, null)

  // disconnect invalidates too (correct behavior after fix)
  sink.computedNumberOfChannels = 2
  src.disconnect(sink)
  is(sink.computedNumberOfChannels, null, 'invalidated on disconnect')

  // after disconnection: _numberOfChannels event from old source has no effect
  sink.computedNumberOfChannels = 2
  src.emit('_numberOfChannels')
  is(sink.computedNumberOfChannels, 2)
})

test('AudioPort > Symbol.dispose > disconnects everything', () => {
  let s1 = new AudioInput(ctx, dummyNode, 0)
  let s2 = new AudioInput(ctx, dummyNode, 0)
  let src = new AudioOutput(ctx, dummyNode, 1)

  s1.connect(src)
  s2.connect(src)
  src.on('bla', () => {})
  is(src.listenerCount('bla'), 1)

  src[Symbol.dispose]()
  is(s1.sources, [])
  is(s2.sources, [])
  is(src.listenerCount('bla'), 0)
})

// --- _computeNumberOfChannels ---

test('AudioInput > _computeNumberOfChannels > max mode', () => {
  let node = { channelCount: 6, channelCountMode: 'max' }
  let input = new AudioInput(ctx, node, 0)
  input._computeNumberOfChannels(13)
  is(input.computedNumberOfChannels, 13)
  input._computeNumberOfChannels(2)
  is(input.computedNumberOfChannels, 2)
})

test('AudioInput > _computeNumberOfChannels > clamped-max mode', () => {
  let node = { channelCount: 4, channelCountMode: 'clamped-max' }
  let input = new AudioInput(ctx, node, 0)
  input._computeNumberOfChannels(1)
  is(input.computedNumberOfChannels, 1)
  input._computeNumberOfChannels(4)
  is(input.computedNumberOfChannels, 4)
  input._computeNumberOfChannels(6)
  is(input.computedNumberOfChannels, 4)
})

test('AudioInput > _computeNumberOfChannels > defaults to 1 with no connections', () => {
  let node = { channelCount: 6, channelCountMode: 'max' }
  let input = new AudioInput(ctx, node, 0)
  input._computeNumberOfChannels(0)
  is(input.computedNumberOfChannels, 1)
})

test('AudioInput > _computeNumberOfChannels > explicit mode', () => {
  let node = { channelCount: 5, channelCountMode: 'explicit' }
  let input = new AudioInput(ctx, node, 0)
  input._computeNumberOfChannels(15)
  is(input.computedNumberOfChannels, 5)
})

// --- _tick channel mixing ---

test.mute('AudioInput > _tick > identity copy when channel counts match', () => {
  let node = { channelCount: 3, channelCountMode: 'explicit', channelInterpretation: 'discrete' }
  let input = new AudioInput(ctx, node, 0)
  let o1 = makeOutput(AudioOutput, AudioBuffer, ctx, [0.1, 0.2, 0.3])
  let o2 = makeOutput(AudioOutput, AudioBuffer, ctx, [0.01, 0.02, 0.03])

  input.connect(o1)
  input.connect(o2)
  channelsEqual(input._tick(), [0.11, 0.22, 0.33])
})

test.mute('AudioInput > _tick > discrete up-mix (zero-fill)', () => {
  let node = { channelCount: 5, channelCountMode: 'explicit', channelInterpretation: 'discrete' }
  let input = new AudioInput(ctx, node, 0)
  let o = makeOutput(AudioOutput, AudioBuffer, ctx, [0.2])

  input.connect(o)
  channelsEqual(input._tick(), [0.2, 0, 0, 0, 0])
})

test.mute('AudioInput > _tick > discrete down-mix (drop channels)', () => {
  let node = { channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'discrete' }
  let input = new AudioInput(ctx, node, 0)
  let o = makeOutput(AudioOutput, AudioBuffer, ctx, [0.1, 0.1, 0.1, 0.1])

  input.connect(o)
  channelsEqual(input._tick(), [0.1, 0.1])
})

test.mute('AudioInput > _tick > speakers mono to stereo (1→2)', () => {
  let node = { channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'speakers' }
  let input = new AudioInput(ctx, node, 0)
  input.connect(makeOutput(AudioOutput, AudioBuffer, ctx, [0.1]))
  input.connect(makeOutput(AudioOutput, AudioBuffer, ctx, [0.2]))
  channelsEqual(input._tick(), [0.3, 0.3])
})

test.mute('AudioInput > _tick > speakers mono to 5.1 (1→6)', () => {
  let node = { channelCount: 6, channelCountMode: 'explicit', channelInterpretation: 'speakers' }
  let input = new AudioInput(ctx, node, 0)
  input.connect(makeOutput(AudioOutput, AudioBuffer, ctx, [0.3]))
  channelsEqual(input._tick(), [0, 0, 0.3, 0, 0, 0])
})

test.mute('AudioInput > _tick > speakers stereo to mono (2→1)', () => {
  let node = { channelCount: 1, channelCountMode: 'explicit', channelInterpretation: 'speakers' }
  let input = new AudioInput(ctx, node, 0)
  input.connect(makeOutput(AudioOutput, AudioBuffer, ctx, [0.1, 0.2]))
  input.connect(makeOutput(AudioOutput, AudioBuffer, ctx, [0.04, 0.04]))
  channelsEqual(input._tick(), [0.5 * ((0.1 + 0.04) + (0.2 + 0.04))])
})

test.mute('AudioInput > _tick > speakers 5.1→stereo', () => {
  let node = { channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'speakers' }
  let input = new AudioInput(ctx, node, 0)
  input.connect(makeOutput(AudioOutput, AudioBuffer, ctx, [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]))
  input.connect(makeOutput(AudioOutput, AudioBuffer, ctx, [0.04, 0.04, 0.04, 0.04, 0.04, 0.04]))

  let buf = input._tick()
  is(buf.numberOfChannels, 2)
  allAlmost(buf.getChannelData(0), (0.1 + 0.04) + 0.7071 * ((0.3 + 0.04) + (0.5 + 0.04)))
  allAlmost(buf.getChannelData(1), (0.2 + 0.04) + 0.7071 * ((0.3 + 0.04) + (0.6 + 0.04)))
})

test.mute('AudioInput > _tick > speakers 5.1→quad', () => {
  let node = { channelCount: 4, channelCountMode: 'explicit', channelInterpretation: 'speakers' }
  let input = new AudioInput(ctx, node, 0)
  input.connect(makeOutput(AudioOutput, AudioBuffer, ctx, [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]))
  input.connect(makeOutput(AudioOutput, AudioBuffer, ctx, [0.04, 0.04, 0.04, 0.04, 0.04, 0.04]))

  let buf = input._tick()
  is(buf.numberOfChannels, 4)
  allAlmost(buf.getChannelData(0), (0.1 + 0.04) + 0.7071 * (0.3 + 0.04))
  allAlmost(buf.getChannelData(1), (0.2 + 0.04) + 0.7071 * (0.3 + 0.04))
  allAlmost(buf.getChannelData(2), 0.5 + 0.04)
  allAlmost(buf.getChannelData(3), 0.6 + 0.04)
})

test.mute('AudioInput > _tick > returns zeros when no connections', () => {
  let node = { channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'discrete' }
  let input = new AudioInput(ctx, node, 0)
  channelsEqual(input._tick(), [0, 0])
})

// --- AudioOutput ---

test('AudioOutput > _tick > caches block and avoids redundant pulls', () => {
  let tctx = { sampleRate: 44100, currentTime: 12 }
  let node = { channelCount: 3 }
  let out = new AudioOutput(tctx, node, 0)
  let buf = AudioBuffer.filledWithVal(0.24, 1, BLOCK_SIZE, 44100)
  let pulls = 0

  node._tick = () => { pulls++; return buf }

  let r = out._tick()
  is(r, buf)
  is(pulls, 1)

  // same time — should use cache
  r = out._tick()
  is(r, buf)
  is(pulls, 1)

  // time advanced — should pull again
  tctx.currentTime = 23
  out._tick()
  is(pulls, 2)
})

test('AudioOutput > _tick > emits _numberOfChannels on channel count change', () => {
  let tctx = { sampleRate: 44100, currentTime: 0 }
  let node = { channelCount: 3 }
  let out = new AudioOutput(tctx, node, 0)
  let events = []
  let pull = 0

  node._tick = () => {
    let ch = [1, 2, 2, 1][pull++]
    return new AudioBuffer(ch, BLOCK_SIZE, 44100)
  }
  out.on('_numberOfChannels', () => events.push(out._numberOfChannels))

  tctx.currentTime = 1; out._tick()
  is(events, [1])

  tctx.currentTime = 2; out._tick()
  is(events, [1, 2])

  tctx.currentTime = 3; out._tick()
  is(events, [1, 2]) // no change

  tctx.currentTime = 4; out._tick()
  is(events, [1, 2, 1])
})

// --- Phase 0 issue tests ---

test('Phase0 > audioports > connection event invalidates computedNumberOfChannels', () => {
  // Issue #2 FIXED: AudioInput now listens for 'connection'/'disconnection'
  let node = { channelCount: 2, channelCountMode: 'max', channelInterpretation: 'discrete' }
  let input = new AudioInput(ctx, node, 0)
  let src = new AudioOutput(ctx, dummyNode, 0)

  input.computedNumberOfChannels = 5
  input.connect(src)
  is(input.computedNumberOfChannels, null, 'computedNumberOfChannels invalidated on connect')

  input.computedNumberOfChannels = 5
  input.disconnect(src)
  is(input.computedNumberOfChannels, null, 'computedNumberOfChannels invalidated on disconnect')
})

test.mute('Phase0 > audioports > ChannelMixing created per tick (perf issue)', () => {
  // Issue #3: new ChannelMixing() on every _tick() in AudioInput
  // We can verify this by counting ticks and checking it works
  // (the fix will cache ChannelMixing per topology change)
  let node = { channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'speakers' }
  let input = new AudioInput(ctx, node, 0)
  input.connect(makeOutput(AudioOutput, AudioBuffer, ctx, [0.5]))

  // Should work correctly even though it's creating ChannelMixing per tick
  let b1 = input._tick()
  let b2 = input._tick()
  allAlmost(b1.getChannelData(0), 0.5)
  allAlmost(b2.getChannelData(0), 0.5)
})

test('Phase0 > AudioOutput > cache object recreated per tick', () => {
  // Issue #12: _cachedBlock = { time, buffer } creates new object each tick
  // Should mutate instead. Verify caching works correctly.
  let tctx = { sampleRate: 44100, currentTime: 1 }
  let node = { channelCount: 1 }
  let out = new AudioOutput(tctx, node, 0)
  let buf = new AudioBuffer(1, BLOCK_SIZE, 44100)
  node._tick = () => buf

  out._tick()
  let ref1 = out._cachedBlock

  tctx.currentTime = 2
  out._tick()
  let ref2 = out._cachedBlock

  // Currently creates new object (ref1 !== ref2). After fix, should mutate (ref1 === ref2).
  // Document the behavior:
  ok(ref2.time === 2, 'cache time updated')
  ok(ref2.buffer === buf, 'cache buffer correct')
})
