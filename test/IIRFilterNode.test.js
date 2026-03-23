import test from 'tst'
import { ok, throws, almost } from 'tst'
import AudioNode from '../src/AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { fill } from 'audio-buffer/util'
import IIRFilterNode from '../src/IIRFilterNode.js'
import { BLOCK_SIZE } from '../src/constants.js'

let SR = 44100
let wire = (c, node, buf) => { let s = new AudioNode(c, 0, 1); s.connect(node); s._tick = () => buf; return s }

test('IIRFilterNode > identity passthrough', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new IIRFilterNode(c, { feedforward: [1], feedback: [1] })
  wire(c, node, fill(new AudioBuffer(1, BLOCK_SIZE, SR), 0.7))
  c.currentTime = 1; almost(node._tick().getChannelData(0)[0], 0.7, 1e-6)
})

test('IIRFilterNode > getFrequencyResponse', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new IIRFilterNode(c, { feedforward: [1, -1], feedback: [1, -0.9] })
  let freqs = new Float32Array([100, 10000])
  let mag = new Float32Array(2), phase = new Float32Array(2)
  node.getFrequencyResponse(freqs, mag, phase)
  ok(mag[1] > mag[0], 'highpass: high freq > low freq')
})

test.mute('IIRFilterNode > 1-pole lowpass converges on DC', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new IIRFilterNode(c, { feedforward: [0.1], feedback: [1, -0.9] })
  wire(c, node, fill(new AudioBuffer(1, BLOCK_SIZE, SR), 1))
  for (let i = 0; i < 50; i++) { c.currentTime = i; node._tick() }
  c.currentTime = 50; almost(node._tick().getChannelData(0)[BLOCK_SIZE - 1], 1, 0.05, 'DC converges')
})

test('IIRFilterNode > rejects invalid coefficients', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  throws(() => new IIRFilterNode(c, { feedforward: [], feedback: [1] }))
  throws(() => new IIRFilterNode(c, { feedforward: [1], feedback: [] }))
  throws(() => new IIRFilterNode(c, { feedforward: [1], feedback: [0] }))
})

test('IIRFilterNode > rejects missing options', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  throws(() => new IIRFilterNode(c))
  throws(() => new IIRFilterNode(c, { feedback: [1] }))
  throws(() => new IIRFilterNode(c, { feedforward: [1] }))
})

test('IIRFilterNode > rejects all-zero feedforward', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  throws(() => new IIRFilterNode(c, { feedforward: [0, 0], feedback: [1] }))
})

test('IIRFilterNode > rejects too many coefficients', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let big = new Float32Array(21); big[0] = 1
  throws(() => new IIRFilterNode(c, { feedforward: Array.from(big), feedback: [1] }))
  throws(() => new IIRFilterNode(c, { feedforward: [1], feedback: Array.from(big) }))
})

test('IIRFilterNode > accepts max 20 coefficients', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let coef = new Float32Array(20); coef[0] = 1
  let node = new IIRFilterNode(c, { feedforward: Array.from(coef), feedback: Array.from(coef) })
  ok(node instanceof IIRFilterNode)
})

test('IIRFilterNode > getFrequencyResponse NaN for out-of-range', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new IIRFilterNode(c, { feedforward: [1], feedback: [1, -0.9] })
  let freqs = new Float32Array([-1, SR])
  let mag = new Float32Array(2), phase = new Float32Array(2)
  node.getFrequencyResponse(freqs, mag, phase)
  ok(Number.isNaN(mag[0]), 'negative freq -> NaN mag')
  ok(Number.isNaN(phase[0]), 'negative freq -> NaN phase')
  ok(Number.isNaN(mag[1]), 'above nyquist -> NaN mag')
  ok(Number.isNaN(phase[1]), 'above nyquist -> NaN phase')
})

test('IIRFilterNode > getFrequencyResponse validates args', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new IIRFilterNode(c, { feedforward: [1], feedback: [1] })
  throws(() => node.getFrequencyResponse(null, new Float32Array(1), new Float32Array(1)))
  throws(() => node.getFrequencyResponse(new Float32Array(1), null, new Float32Array(1)))
  throws(() => node.getFrequencyResponse(new Float32Array(1), new Float32Array(1), null))
  throws(() => node.getFrequencyResponse(new Float32Array(10), new Float32Array(1), new Float32Array(20)))
})
