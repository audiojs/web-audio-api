import test from 'tst'
import { is, ok, almost } from 'tst'
import AudioNode from '../src/AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { fill } from 'audio-buffer/util'
import DynamicsCompressorNode from '../src/DynamicsCompressorNode.js'
import { BLOCK_SIZE } from '../src/constants.js'

let SR = 44100
let wire = (c, node, buf) => { let s = new AudioNode(c, 0, 1); s.connect(node); s._tick = () => buf; return s }

test('DynamicsCompressorNode > defaults', () => {
  let node = new DynamicsCompressorNode({ sampleRate: SR, currentTime: 0 })
  is(node.threshold.value, -24); is(node.knee.value, 30); is(node.ratio.value, 12)
  almost(node.attack.value, 0.003, 1e-6); almost(node.release.value, 0.25, 1e-6)
  is(node.reduction, 0)
})

test.mute('DynamicsCompressorNode > compresses loud signal', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new DynamicsCompressorNode(c)
  wire(c, node, fill(new AudioBuffer(1, BLOCK_SIZE, SR), 1.0))
  let buf
  for (let t = 0; t < 20; t++) { c.currentTime = t; buf = node._tick() }
  let peak = 0, d = buf.getChannelData(0)
  for (let i = 0; i < BLOCK_SIZE; i++) peak = Math.max(peak, Math.abs(d[i]))
  ok(peak < 1.0, 'output quieter'); ok(node.reduction < 0, 'reduction negative')
})

test.mute('DynamicsCompressorNode > attack/release timing', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new DynamicsCompressorNode(c)
  let src = wire(c, node, fill(new AudioBuffer(1, BLOCK_SIZE, SR), 1.0))
  for (let t = 0; t < 50; t++) { c.currentTime = t; node._tick() }
  let reductionLoud = node.reduction
  ok(reductionLoud < -1, `loud reduces: ${reductionLoud.toFixed(1)}dB`)
  src._tick = () => fill(new AudioBuffer(1, BLOCK_SIZE, SR), 0)
  for (let t = 50; t < 200; t++) { c.currentTime = t; node._tick() }
  ok(Math.abs(node.reduction) < Math.abs(reductionLoud), 'release recovers')
})
