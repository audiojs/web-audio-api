import test from 'tst'
import { ok, throws, almost } from 'tst'
import AudioNode from '../src/AudioNode.js'
import AudioBuffer from 'audio-buffer'
import WaveShaperNode from '../src/WaveShaperNode.js'
import { BLOCK_SIZE } from '../src/constants.js'

let SR = 44100
let wire = (c, node, buf) => { let s = new AudioNode(c, 0, 1); s.connect(node); s._tick = () => buf; return s }

test('WaveShaperNode > passthrough when curve is null', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new WaveShaperNode(c)
  wire(c, node, AudioBuffer.filledWithVal(0.5, 1, BLOCK_SIZE, SR))
  c.currentTime = 1; almost(node._tick().getChannelData(0)[0], 0.5, 1e-6)
})

test('WaveShaperNode > hard clip curve', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new WaveShaperNode(c)
  node.curve = new Float32Array([-0.5, -0.5, 0, 0.5, 0.5])
  wire(c, node, AudioBuffer.filledWithVal(1, 1, BLOCK_SIZE, SR))
  c.currentTime = 1; almost(node._tick().getChannelData(0)[0], 0.5, 0.01, 'clipped')
})

test.mute('WaveShaperNode > 2x oversample preserves DC', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new WaveShaperNode(c)
  let n = 256, curve = new Float32Array(n)
  for (let i = 0; i < n; i++) curve[i] = (i / (n - 1)) * 2 - 1
  node.curve = curve; node.oversample = '2x'
  wire(c, node, AudioBuffer.filledWithVal(0.5, 1, BLOCK_SIZE, SR))
  c.currentTime = 1; almost(node._tick().getChannelData(0)[BLOCK_SIZE - 1], 0.5, 0.1, '2x preserves DC')
})

test('WaveShaperNode > rejects invalid curve', () => {
  let node = new WaveShaperNode({ sampleRate: SR, currentTime: 0 })
  throws(() => { node.curve = 'bad' })
  throws(() => { node.curve = new Float32Array(1) })
})

test('WaveShaperNode > rejects invalid oversample', () => {
  throws(() => { new WaveShaperNode({ sampleRate: SR, currentTime: 0 }).oversample = '8x' })
})
