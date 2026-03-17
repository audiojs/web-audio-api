import test from 'tst'
import { is, ok, throws, almost } from 'tst'
import ConstantSourceNode from '../src/ConstantSourceNode.js'
import { BLOCK_SIZE } from '../src/constants.js'

test('ConstantSourceNode > outputs constant value', () => {
  let c = { sampleRate: 44100, currentTime: 0 }
  let node = new ConstantSourceNode(c)
  node.start(0)
  c.currentTime = 0; node._tick()
  let buf = node._tick()
  is(buf.numberOfChannels, 1)
  for (let i = 0; i < BLOCK_SIZE; i++) almost(buf.getChannelData(0)[i], 1, 1e-6)
})

test('ConstantSourceNode > offset automation', () => {
  let c = { sampleRate: 44100, currentTime: 0 }
  let node = new ConstantSourceNode(c)
  node.offset.value = 0.5
  node.start(0)
  c.currentTime = 0; node._tick()
  let buf = node._tick()
  for (let i = 0; i < BLOCK_SIZE; i++) almost(buf.getChannelData(0)[i], 0.5, 1e-6)
})

test('ConstantSourceNode > outputs zeros before start', () => {
  let c = { sampleRate: 44100, currentTime: 0 }
  let node = new ConstantSourceNode(c)
  let buf = node._tick()
  for (let i = 0; i < BLOCK_SIZE; i++) is(buf.getChannelData(0)[i], 0)
})

test('ConstantSourceNode > start() twice throws InvalidStateError', () => {
  let c = { sampleRate: 44100, currentTime: 0 }
  let node = new ConstantSourceNode(c)
  node.start(0)
  throws(() => node.start(0))
})

test('ConstantSourceNode > stop() before start() throws', () => {
  let c = { sampleRate: 44100, currentTime: 0 }
  throws(() => new ConstantSourceNode(c).stop(0))
})
