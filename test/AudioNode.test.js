import test from 'tst'
import { is, ok, throws } from 'tst'
import AudioNode from '../src/AudioNode.js'

let ctx = {}

test('AudioNode > creates AudioInputs and AudioOutputs', () => {
  let node = new AudioNode(ctx, 1, 2)
  is(node._inputs.length, 1)
  is(node._outputs.length, 2)
  is(node._inputs[0].id, 0)
  is(node._inputs[0].node, node)
  is(node._outputs[0].id, 0)
  is(node._outputs[1].id, 1)
})

test('AudioNode > inherits EventEmitter', () => {
  let node = new AudioNode(ctx, 1, 2)
  ok(node.on, 'has .on()')
  ok(node.once, 'has .once()')
})

test('AudioNode > channelCount > accepts valid values', () => {
  let node = new AudioNode(ctx, 1, 1)
  is(node.channelCount, 2)
  node.channelCount = 1
  is(node.channelCount, 1)
  node.channelCount = 109
  is(node.channelCount, 109)
})

test('AudioNode > channelCount > rejects invalid values', () => {
  let node = new AudioNode(ctx, 1, 1)
  throws(() => { node.channelCount = 0 })
  throws(() => { node.channelCount = -10 })
})

test('AudioNode > channelCountMode > accepts valid values', () => {
  let node = new AudioNode(ctx, 1, 1)
  node.channelCountMode = 'max'
  is(node.channelCountMode, 'max')
  node.channelCountMode = 'clamped-max'
  is(node.channelCountMode, 'clamped-max')
  node.channelCountMode = 'explicit'
  is(node.channelCountMode, 'explicit')
})

test('AudioNode > channelCountMode > rejects invalid values', () => {
  let node = new AudioNode(ctx, 1, 1)
  throws(() => { node.channelCountMode = 'bad' })
  throws(() => { node.channelCountMode = 10 })
})

test('AudioNode > channelInterpretation > accepts valid values', () => {
  let node = new AudioNode(ctx, 1, 1)
  node.channelInterpretation = 'speakers'
  is(node.channelInterpretation, 'speakers')
  node.channelInterpretation = 'discrete'
  is(node.channelInterpretation, 'discrete')
})

test('AudioNode > channelInterpretation > rejects invalid values', () => {
  let node = new AudioNode(ctx, 1, 1)
  throws(() => { node.channelInterpretation = 'bad' })
  throws(() => { node.channelInterpretation = 10 })
})

test('AudioNode > connect > connects audio ports', () => {
  let src = new AudioNode(ctx, 0, 3)
  let sink = new AudioNode(ctx, 3, 0)

  src.connect(sink)
  is(sink._inputs[0].sources.length, 1)
  is(sink._inputs[0].sources[0], src._outputs[0])

  // duplicate connect is no-op
  src.connect(sink)
  is(sink._inputs[0].sources.length, 1)

  src.connect(sink, 2, 1)
  is(sink._inputs[1].sources.length, 1)
  is(sink._inputs[1].sources[0], src._outputs[2])
})

test('AudioNode > connect > throws on out-of-bounds', () => {
  let src = new AudioNode(ctx, 0, 3)
  let sink = new AudioNode(ctx, 3, 0)
  throws(() => src.connect(src, 0, 5))
  throws(() => src.connect(src, 6))
})

test('AudioNode > disconnect > disconnects all sinks from output', () => {
  let src = new AudioNode(ctx, 0, 3)
  let s1 = new AudioNode(ctx, 3, 0)
  let s2 = new AudioNode(ctx, 3, 0)

  src.connect(s1, 1)
  src.connect(s2, 1)
  src.connect(s2, 2)

  src.disconnect(1)
  is(src._outputs[1].sinks.length, 0)
  is(src._outputs[2].sinks.length, 1)

  src.disconnect(2)
  is(src._outputs[2].sinks.length, 0)
})

test('AudioNode > disconnect > defaults to output 0', () => {
  let src = new AudioNode(ctx, 0, 3)
  let s1 = new AudioNode(ctx, 3, 0)
  let s2 = new AudioNode(ctx, 3, 0)

  src.connect(s1, 0)
  src.connect(s2, 0)
  src.connect(s2, 1)
  is(src._outputs[0].sinks.length, 2)

  src.disconnect()
  is(src._outputs[0].sinks.length, 0)
  is(src._outputs[1].sinks.length, 1)
})

test('AudioNode > disconnect > throws on out-of-bounds', () => {
  let src = new AudioNode(ctx, 0, 3)
  throws(() => src.disconnect(8))
})

test('AudioNode > Symbol.dispose > disconnects all and removes listeners', () => {
  let src = new AudioNode(ctx, 0, 3)
  let s1 = new AudioNode(ctx, 3, 0)
  let s2 = new AudioNode(ctx, 3, 0)

  src.connect(s1, 1)
  src.connect(s2, 1)
  src.connect(s2, 2)
  src.on('bla', () => {})
  is(src.listeners('bla').length, 1)

  src[Symbol.dispose]()
  is(src.listeners('bla').length, 0)
  is(src._outputs[1].sinks.length, 0)
  is(src._outputs[2].sinks.length, 0)
})
