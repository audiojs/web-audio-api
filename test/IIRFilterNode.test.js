import test from 'tst'
import { ok, throws, almost } from 'tst'
import AudioNode from '../src/AudioNode.js'
import AudioBuffer from 'audio-buffer'
import IIRFilterNode from '../src/IIRFilterNode.js'
import { BLOCK_SIZE } from '../src/constants.js'

let SR = 44100
let wire = (c, node, buf) => { let s = new AudioNode(c, 0, 1); s.connect(node); s._tick = () => buf; return s }

test('IIRFilterNode > identity passthrough', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new IIRFilterNode(c, [1], [1])
  wire(c, node, AudioBuffer.filledWithVal(0.7, 1, BLOCK_SIZE, SR))
  c.currentTime = 1; almost(node._tick().getChannelData(0)[0], 0.7, 1e-6)
})

test('IIRFilterNode > getFrequencyResponse', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new IIRFilterNode(c, [1, -1], [1, -0.9])
  let freqs = new Float32Array([100, 10000])
  let mag = new Float32Array(2), phase = new Float32Array(2)
  node.getFrequencyResponse(freqs, mag, phase)
  ok(mag[1] > mag[0], 'highpass: high freq > low freq')
})

test.mute('IIRFilterNode > 1-pole lowpass converges on DC', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new IIRFilterNode(c, [0.1], [1, -0.9])
  wire(c, node, AudioBuffer.filledWithVal(1, 1, BLOCK_SIZE, SR))
  for (let i = 0; i < 50; i++) { c.currentTime = i; node._tick() }
  c.currentTime = 50; almost(node._tick().getChannelData(0)[BLOCK_SIZE - 1], 1, 0.05, 'DC converges')
})

test('IIRFilterNode > rejects invalid coefficients', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  throws(() => new IIRFilterNode(c, [], [1]))
  throws(() => new IIRFilterNode(c, [1], []))
  throws(() => new IIRFilterNode(c, [1], [0]))
})
