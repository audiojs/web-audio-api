import test from 'tst'
import { is, ok, almost } from 'tst'
import AudioContext from '../src/AudioContext.js'
import AudioNode from '../src/AudioNode.js'
import AudioBuffer from 'audio-buffer'
import OscillatorNode from '../src/OscillatorNode.js'
import GainNode from '../src/GainNode.js'
import ChannelSplitterNode from '../src/ChannelSplitterNode.js'
import { BLOCK_SIZE } from '../src/constants.js'

let SR = 44100

test.mute('Integration > oscillator → gain → output', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let osc = new OscillatorNode(c)
  let gain = new GainNode(c)
  osc.frequency.value = 440; gain.gain.value = 0.5
  osc.start(0); c.currentTime = 0; osc._tick()
  let src = new AudioNode(c, 0, 1)
  src.connect(gain); src._tick = () => osc._tick()
  c.currentTime = 1; let buf = gain._tick()
  let max = 0, d = buf.getChannelData(0)
  for (let i = 0; i < BLOCK_SIZE; i++) max = Math.max(max, Math.abs(d[i]))
  ok(max > 0.1 && max <= 0.55, `gain-scaled peak: ${max.toFixed(3)}`)
})

test.mute('Integration > splitter splits stereo correctly through graph', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let splitter = new ChannelSplitterNode(c, { numberOfOutputs: 2 })
  let stereo = new AudioBuffer(2, BLOCK_SIZE, SR)
  stereo.getChannelData(0).fill(0.8); stereo.getChannelData(1).fill(0.2)
  let src = new AudioNode(c, 0, 1); src.connect(splitter); src._tick = () => stereo
  c.currentTime = 1; splitter._tick()
  almost(splitter._tickOutput(0).getChannelData(0)[0], 0.8, 1e-6, 'split L')
  almost(splitter._tickOutput(1).getChannelData(0)[0], 0.2, 1e-6, 'split R')
})

test('AudioContext > all factory methods', () => {
  let c = new AudioContext(); c.outStream = { end() {} }; c[Symbol.dispose]()
  ok(c.createBufferSource()); ok(c.createConstantSource()); ok(c.createOscillator())
  ok(c.createPeriodicWave(new Float32Array([0, 0]), new Float32Array([0, 1])))
  ok(c.createGain()); ok(c.createStereoPanner()); ok(c.createDelay())
  ok(c.createBiquadFilter()); ok(c.createWaveShaper()); ok(c.createIIRFilter([1], [1]))
  ok(c.createConvolver()); ok(c.createDynamicsCompressor()); ok(c.createChannelSplitter())
  ok(c.createChannelMerger()); ok(c.createAnalyser()); ok(c.createScriptProcessor(1024, 1, 1))
  ok(c.createPanner())
})

test('index.js > all types exported', async () => {
  let mod = await import('../index.js')
  for (let name of [
    'AudioContext', 'AudioParam', 'AudioNode', 'AudioScheduledSourceNode',
    'AudioDestinationNode', 'AudioBuffer', 'AudioBufferSourceNode',
    'ConstantSourceNode', 'OscillatorNode', 'PeriodicWave',
    'GainNode', 'StereoPannerNode', 'DelayNode', 'BiquadFilterNode',
    'WaveShaperNode', 'IIRFilterNode', 'ConvolverNode', 'DynamicsCompressorNode',
    'ChannelSplitterNode', 'ChannelMergerNode', 'AnalyserNode',
    'ScriptProcessorNode', 'PannerNode', 'AudioListener'
  ]) ok(mod[name], name)
})
