import test from 'tst'
import { is, ok, throws, almost } from 'tst'
import AudioNode from '../src/AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { fill } from 'audio-buffer/util'
import AnalyserNode from '../src/AnalyserNode.js'
import { BLOCK_SIZE } from '../src/constants.js'

let SR = 44100
let wire = (c, node, buf) => { let s = new AudioNode(c, 0, 1); s.connect(node); s._tick = () => buf; return s }

test('AnalyserNode > defaults', () => {
  let node = new AnalyserNode({ sampleRate: SR, currentTime: 0 })
  is(node.fftSize, 2048); is(node.frequencyBinCount, 1024)
  is(node.minDecibels, -100); is(node.maxDecibels, -30)
  almost(node.smoothingTimeConstant, 0.8, 1e-6)
})

test('AnalyserNode > fftSize validation', () => {
  let node = new AnalyserNode({ sampleRate: SR, currentTime: 0 })
  node.fftSize = 512; is(node.fftSize, 512); is(node.frequencyBinCount, 256)
  throws(() => { node.fftSize = 100 }); throws(() => { node.fftSize = 16 })
})

test.mute('AnalyserNode > passthrough', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new AnalyserNode(c)
  wire(c, node, fill(new AudioBuffer(1, BLOCK_SIZE, SR), 0.5))
  c.currentTime = 1; almost(node._tick().getChannelData(0)[0], 0.5, 1e-6, 'passthrough')
})

test.mute('AnalyserNode > FFT detects 1kHz sine', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new AnalyserNode(c); node.fftSize = 2048; node.smoothingTimeConstant = 0
  let phase = 0, freq = 1000
  wire(c, node, null)
  let src = node._inputs[0].sources[0].node
  src._tick = () => {
    let b = new AudioBuffer(1, BLOCK_SIZE, SR), d = b.getChannelData(0)
    for (let i = 0; i < BLOCK_SIZE; i++) { d[i] = Math.sin(phase); phase += 2 * Math.PI * freq / SR }
    return b
  }
  for (let t = 0; t < 20; t++) { c.currentTime = t; node._tick() }
  let spectrum = new Float32Array(node.frequencyBinCount)
  node.getFloatFrequencyData(spectrum)
  let peakBin = 0, peakVal = -Infinity
  for (let i = 0; i < spectrum.length; i++) if (spectrum[i] > peakVal) { peakVal = spectrum[i]; peakBin = i }
  almost(peakBin * SR / node.fftSize, freq, 50, `peak at ~${freq}Hz`)
})
