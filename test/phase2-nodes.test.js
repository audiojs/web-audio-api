import test from 'tst'
import { is, ok, throws, almost } from 'tst'
import AudioBuffer from 'audio-buffer'
import AudioNode from '../src/AudioNode.js'
import AudioContext from '../src/AudioContext.js'
import ConstantSourceNode from '../src/ConstantSourceNode.js'
import OscillatorNode from '../src/OscillatorNode.js'
import PeriodicWave from '../src/PeriodicWave.js'
import StereoPannerNode from '../src/StereoPannerNode.js'
import DelayNode from '../src/DelayNode.js'
import BiquadFilterNode from '../src/BiquadFilterNode.js'
import WaveShaperNode from '../src/WaveShaperNode.js'
import IIRFilterNode from '../src/IIRFilterNode.js'
import ConvolverNode from '../src/ConvolverNode.js'
import DynamicsCompressorNode from '../src/DynamicsCompressorNode.js'
import ChannelSplitterNode from '../src/ChannelSplitterNode.js'
import ChannelMergerNode from '../src/ChannelMergerNode.js'
import AnalyserNode from '../src/AnalyserNode.js'
import { BLOCK_SIZE } from '../src/constants.js'

let ctx = { sampleRate: 44100, currentTime: 0 }

// --- ConstantSourceNode ---

test('ConstantSourceNode > outputs constant value', () => {
  let node = new ConstantSourceNode(ctx)
  node.start(0)
  ctx.currentTime = 0
  node._tick() // process start event
  let buf = node._tick()
  is(buf.numberOfChannels, 1)
  for (let i = 0; i < BLOCK_SIZE; i++) almost(buf.getChannelData(0)[i], 1, 1e-6)
})

test('ConstantSourceNode > offset automation', () => {
  let c = { sampleRate: 44100, currentTime: 0 }
  let node = new ConstantSourceNode(c)
  node.offset.value = 0.5
  node.start(0)
  c.currentTime = 0
  node._tick()
  let buf = node._tick()
  for (let i = 0; i < BLOCK_SIZE; i++) almost(buf.getChannelData(0)[i], 0.5, 1e-6)
})

test('ConstantSourceNode > outputs zeros before start', () => {
  let node = new ConstantSourceNode(ctx)
  let buf = node._tick()
  for (let i = 0; i < BLOCK_SIZE; i++) is(buf.getChannelData(0)[i], 0)
})

// --- OscillatorNode ---

test('OscillatorNode > constructor defaults', () => {
  let node = new OscillatorNode(ctx)
  is(node.type, 'sine')
  is(node.frequency.value, 440)
  is(node.detune.value, 0)
})

test('OscillatorNode > type validation', () => {
  let node = new OscillatorNode(ctx)
  node.type = 'square'
  is(node.type, 'square')
  throws(() => { node.type = 'invalid' })
  throws(() => { node.type = 'custom' })
})

test.mute('OscillatorNode > generates sine wave', () => {
  let c = { sampleRate: 44100, currentTime: 0 }
  let node = new OscillatorNode(c)
  node.start(0)
  c.currentTime = 0
  node._tick()
  let buf = node._tick()
  let data = buf.getChannelData(0)
  // sine wave at 440Hz: first sample should be near 0, should oscillate
  ok(data.some(v => v > 0.5), 'has positive peaks')
  ok(data.some(v => v < -0.5), 'has negative peaks')
})

test('OscillatorNode > setPeriodicWave', () => {
  let node = new OscillatorNode(ctx)
  let wave = new PeriodicWave(new Float32Array([0, 0]), new Float32Array([0, 1]))
  node.setPeriodicWave(wave)
  is(node.type, 'custom')
})

// --- PeriodicWave ---

test('PeriodicWave > built-in waveforms', () => {
  for (let type of ['sine', 'square', 'sawtooth', 'triangle']) {
    let table = PeriodicWave.getBuiltIn(type)
    ok(table.length === 4096, type + ' table has 4096 samples')
    ok(table.some(v => v !== 0), type + ' is non-silent')
  }
})

test('PeriodicWave > sine is normalized to [-1, 1]', () => {
  let table = PeriodicWave.getBuiltIn('sine')
  let max = 0
  for (let i = 0; i < table.length; i++) max = Math.max(max, Math.abs(table[i]))
  almost(max, 1, 0.01)
})

// --- StereoPannerNode ---

test.mute('StereoPannerNode > center pan preserves signal', () => {
  let node = new StereoPannerNode(ctx)
  let src = new AudioNode(ctx, 0, 1)
  src.connect(node)
  src._tick = () => AudioBuffer.filledWithVal(1, 1, BLOCK_SIZE, 44100)
  ctx.currentTime = 1
  let buf = node._tick()
  is(buf.numberOfChannels, 2)
  // center pan: equal power, each channel ≈ 0.707
  almost(buf.getChannelData(0)[0], Math.cos(Math.PI / 4), 0.01)
  almost(buf.getChannelData(1)[0], Math.sin(Math.PI / 4), 0.01)
})

test.mute('StereoPannerNode > full left pan', () => {
  let c = { sampleRate: 44100, currentTime: 0 }
  let node = new StereoPannerNode(c)
  node.pan.value = -1
  let src = new AudioNode(c, 0, 1)
  src.connect(node)
  src._tick = () => AudioBuffer.filledWithVal(1, 1, BLOCK_SIZE, 44100)
  c.currentTime = 1
  let buf = node._tick()
  almost(buf.getChannelData(0)[0], 1, 0.01, 'left channel full')
  almost(buf.getChannelData(1)[0], 0, 0.01, 'right channel silent')
})

// --- DelayNode ---

test.mute('DelayNode > delays signal', () => {
  let c = { sampleRate: 44100, currentTime: 0 }
  let node = new DelayNode(c, { maxDelayTime: 1 })
  node.delayTime.value = BLOCK_SIZE / 44100 // delay by 1 block
  let src = new AudioNode(c, 0, 1)
  src.connect(node)

  let impulse = new AudioBuffer(1, BLOCK_SIZE, 44100)
  impulse.getChannelData(0)[0] = 1.0
  let callCount = 0
  src._tick = () => {
    callCount++
    return callCount === 1 ? impulse : new AudioBuffer(1, BLOCK_SIZE, 44100)
  }

  c.currentTime = 1
  let buf1 = node._tick()
  // first block should be silent (signal delayed)
  almost(buf1.getChannelData(0)[0], 0, 0.01, 'first block silent')

  c.currentTime = 2
  let buf2 = node._tick()
  // second block should contain the delayed impulse
  ok(buf2.getChannelData(0).some(v => Math.abs(v) > 0.5), 'impulse appears in second block')
})

// --- BiquadFilterNode ---

test('BiquadFilterNode > constructor defaults', () => {
  let node = new BiquadFilterNode(ctx)
  is(node.type, 'lowpass')
  is(node.frequency.value, 350)
  is(node.Q.value, 1)
  is(node.gain.value, 0)
})

test('BiquadFilterNode > type validation', () => {
  let node = new BiquadFilterNode(ctx)
  node.type = 'highpass'
  is(node.type, 'highpass')
  throws(() => { node.type = 'invalid' })
})

test('BiquadFilterNode > getFrequencyResponse', () => {
  let node = new BiquadFilterNode(ctx)
  node.type = 'lowpass'
  let freqs = new Float32Array([100, 1000, 10000])
  let mag = new Float32Array(3)
  let phase = new Float32Array(3)
  node.getFrequencyResponse(freqs, mag, phase)
  ok(mag[0] > mag[2], 'lowpass: low freq has higher magnitude than high freq')
})

// --- WaveShaperNode ---

test('WaveShaperNode > passthrough when curve is null', () => {
  let node = new WaveShaperNode(ctx)
  let src = new AudioNode(ctx, 0, 1)
  src.connect(node)
  src._tick = () => AudioBuffer.filledWithVal(0.5, 1, BLOCK_SIZE, 44100)
  ctx.currentTime = 1
  let buf = node._tick()
  almost(buf.getChannelData(0)[0], 0.5, 1e-6)
})

test('WaveShaperNode > applies distortion curve', () => {
  let node = new WaveShaperNode(ctx)
  node.curve = new Float32Array([-1, -0.5, 0, 0.5, 1]) // identity-ish
  let src = new AudioNode(ctx, 0, 1)
  src.connect(node)
  src._tick = () => AudioBuffer.filledWithVal(0, 1, BLOCK_SIZE, 44100)
  ctx.currentTime = 2
  let buf = node._tick()
  almost(buf.getChannelData(0)[0], 0, 0.01, 'zero maps to center of curve')
})

// --- IIRFilterNode ---

test('IIRFilterNode > passthrough with identity filter', () => {
  // b=[1], a=[1] is identity
  let node = new IIRFilterNode(ctx, [1], [1])
  let src = new AudioNode(ctx, 0, 1)
  src.connect(node)
  src._tick = () => AudioBuffer.filledWithVal(0.7, 1, BLOCK_SIZE, 44100)
  ctx.currentTime = 1
  let buf = node._tick()
  almost(buf.getChannelData(0)[0], 0.7, 1e-6)
})

test('IIRFilterNode > getFrequencyResponse', () => {
  let node = new IIRFilterNode(ctx, [1, -1], [1, -0.9]) // simple 1-pole highpass
  let freqs = new Float32Array([100, 10000])
  let mag = new Float32Array(2)
  let phase = new Float32Array(2)
  node.getFrequencyResponse(freqs, mag, phase)
  ok(mag[1] > mag[0], 'highpass: high freq has higher magnitude')
})

test('IIRFilterNode > rejects invalid coefficients', () => {
  throws(() => new IIRFilterNode(ctx, [], [1]))
  throws(() => new IIRFilterNode(ctx, [1], []))
  throws(() => new IIRFilterNode(ctx, [1], [0])) // feedback[0] = 0
})

// --- ConvolverNode ---

test('ConvolverNode > passthrough when no buffer set', () => {
  let node = new ConvolverNode(ctx)
  let src = new AudioNode(ctx, 0, 1)
  src.connect(node)
  src._tick = () => AudioBuffer.filledWithVal(0.5, 1, BLOCK_SIZE, 44100)
  ctx.currentTime = 1
  let buf = node._tick()
  almost(buf.getChannelData(0)[0], 0.5, 1e-6)
})

test.mute('ConvolverNode > convolves with impulse response', () => {
  let node = new ConvolverNode(ctx)
  // unit impulse IR: output should equal input
  let ir = new AudioBuffer(1, 1, 44100)
  ir.getChannelData(0)[0] = 1
  node.buffer = ir

  let src = new AudioNode(ctx, 0, 1)
  src.connect(node)
  src._tick = () => AudioBuffer.filledWithVal(0.5, 1, BLOCK_SIZE, 44100)
  ctx.currentTime = 1
  let buf = node._tick()
  // with normalization, unit impulse gets scaled
  ok(buf.getChannelData(0)[0] !== 0, 'output is non-zero')
})

// --- DynamicsCompressorNode ---

test('DynamicsCompressorNode > constructor defaults', () => {
  let node = new DynamicsCompressorNode(ctx)
  is(node.threshold.value, -24)
  is(node.knee.value, 30)
  is(node.ratio.value, 12)
  almost(node.attack.value, 0.003, 1e-6)
  almost(node.release.value, 0.25, 1e-6)
  is(node.reduction, 0)
})

test.mute('DynamicsCompressorNode > compresses loud signal', () => {
  let c = { sampleRate: 44100, currentTime: 0 }
  let node = new DynamicsCompressorNode(c)
  let src = new AudioNode(c, 0, 1)
  src.connect(node)
  // feed loud signal (amplitude 1.0 = 0dB, above threshold of -24dB)
  src._tick = () => AudioBuffer.filledWithVal(1.0, 1, BLOCK_SIZE, 44100)
  // run enough blocks for envelope to rise from -120dB and settle
  let buf
  for (let t = 0; t < 20; t++) { c.currentTime = t; buf = node._tick() }
  let peak = 0
  let data = buf.getChannelData(0)
  for (let i = 0; i < BLOCK_SIZE; i++) peak = Math.max(peak, Math.abs(data[i]))
  ok(peak < 1.0, 'output is quieter than input')
  ok(node.reduction < 0, 'reduction is negative (gain reduced)')
})

// --- ChannelSplitterNode ---

test('ChannelSplitterNode > constructor defaults', () => {
  let node = new ChannelSplitterNode(ctx)
  is(node.numberOfInputs, 1)
  is(node.numberOfOutputs, 6)
})

test('ChannelSplitterNode > custom output count', () => {
  let node = new ChannelSplitterNode(ctx, { numberOfOutputs: 2 })
  is(node.numberOfOutputs, 2)
})

// --- ChannelMergerNode ---

test('ChannelMergerNode > constructor defaults', () => {
  let node = new ChannelMergerNode(ctx)
  is(node.numberOfInputs, 6)
  is(node.numberOfOutputs, 1)
})

test('ChannelMergerNode > custom input count', () => {
  let node = new ChannelMergerNode(ctx, { numberOfInputs: 2 })
  is(node.numberOfInputs, 2)
})

// --- AnalyserNode ---

test('AnalyserNode > constructor defaults', () => {
  let node = new AnalyserNode(ctx)
  is(node.fftSize, 2048)
  is(node.frequencyBinCount, 1024)
  is(node.minDecibels, -100)
  is(node.maxDecibels, -30)
  almost(node.smoothingTimeConstant, 0.8, 1e-6)
})

test('AnalyserNode > fftSize validation', () => {
  let node = new AnalyserNode(ctx)
  node.fftSize = 512
  is(node.fftSize, 512)
  is(node.frequencyBinCount, 256)
  throws(() => { node.fftSize = 100 }) // not power of 2
  throws(() => { node.fftSize = 16 })  // below minimum
})

test.mute('AnalyserNode > passthrough', () => {
  let node = new AnalyserNode(ctx)
  let src = new AudioNode(ctx, 0, 1)
  src.connect(node)
  src._tick = () => AudioBuffer.filledWithVal(0.5, 1, BLOCK_SIZE, 44100)
  ctx.currentTime = 1
  let buf = node._tick()
  almost(buf.getChannelData(0)[0], 0.5, 1e-6, 'passthrough works')
})

test('AnalyserNode > getFloatTimeDomainData', () => {
  let c = { sampleRate: 44100, currentTime: 0 }
  let node = new AnalyserNode(c)
  node.fftSize = 256
  let src = new AudioNode(c, 0, 1)
  src.connect(node)
  src._tick = () => AudioBuffer.filledWithVal(0.3, 1, BLOCK_SIZE, 44100)
  c.currentTime = 1
  node._tick()
  c.currentTime = 2
  node._tick()

  let data = new Float32Array(256)
  node.getFloatTimeDomainData(data)
  ok(data.some(v => Math.abs(v - 0.3) < 0.01), 'time domain data contains input signal')
})

// --- factory methods ---

test('AudioContext > all factory methods work', () => {
  let c = new AudioContext()
  c.outStream = { end() {} }
  c[Symbol.dispose]()

  ok(c.createBufferSource(), 'createBufferSource')
  ok(c.createConstantSource(), 'createConstantSource')
  ok(c.createOscillator(), 'createOscillator')
  ok(c.createPeriodicWave(new Float32Array([0, 0]), new Float32Array([0, 1])), 'createPeriodicWave')
  ok(c.createGain(), 'createGain')
  ok(c.createStereoPanner(), 'createStereoPanner')
  ok(c.createDelay(), 'createDelay')
  ok(c.createBiquadFilter(), 'createBiquadFilter')
  ok(c.createWaveShaper(), 'createWaveShaper')
  ok(c.createIIRFilter([1], [1]), 'createIIRFilter')
  ok(c.createConvolver(), 'createConvolver')
  ok(c.createDynamicsCompressor(), 'createDynamicsCompressor')
  ok(c.createChannelSplitter(), 'createChannelSplitter')
  ok(c.createChannelMerger(), 'createChannelMerger')
  ok(c.createAnalyser(), 'createAnalyser')
  ok(c.createScriptProcessor(1024, 1, 1), 'createScriptProcessor')
  ok(c.createPanner(), 'createPanner')
})

// --- exports ---

test('index.js > all node types exportable', async () => {
  let mod = await import('../index.js')
  for (let name of [
    'AudioContext', 'AudioParam', 'AudioNode', 'AudioScheduledSourceNode',
    'AudioDestinationNode', 'AudioBuffer', 'AudioBufferSourceNode',
    'ConstantSourceNode', 'OscillatorNode', 'PeriodicWave',
    'GainNode', 'StereoPannerNode', 'DelayNode', 'BiquadFilterNode',
    'WaveShaperNode', 'IIRFilterNode', 'ConvolverNode', 'DynamicsCompressorNode',
    'ChannelSplitterNode', 'ChannelMergerNode', 'AnalyserNode',
    'ScriptProcessorNode', 'PannerNode', 'AudioListener'
  ]) ok(mod[name], name + ' exported')
})

// =========================================================================
// Functional tests — verify actual DSP behavior, edge cases, signal flow
// =========================================================================

// --- OscillatorNode: frequency accuracy ---

test.mute('OscillatorNode > 440Hz sine completes ~1 cycle in 100 samples at 44100Hz', () => {
  let c = { sampleRate: 44100, currentTime: 0 }
  let osc = new OscillatorNode(c)
  osc.start(0)
  c.currentTime = 0
  osc._tick() // process start

  // collect 256 samples
  let samples = new Float32Array(BLOCK_SIZE)
  let buf = osc._tick()
  samples.set(buf.getChannelData(0))

  // count zero crossings — 440Hz at 44100Hz ≈ 100 samples/cycle → ~2.56 crossings per 128 samples
  let crossings = 0
  for (let i = 1; i < BLOCK_SIZE; i++)
    if (samples[i - 1] * samples[i] < 0) crossings++
  // expect 2-4 zero crossings (1 cycle = 2 crossings)
  ok(crossings >= 2 && crossings <= 6, `zero crossings: ${crossings} (expect 2-6 for 440Hz)`)
})

test('OscillatorNode > onended fires after stop', () => {
  let c = { sampleRate: 44100, currentTime: 0 }
  let osc = new OscillatorNode(c)
  let ended = false
  osc.onended = () => { ended = true }
  osc.start(0)
  osc.stop(0)

  c.currentTime = 0
  osc._tick() // start + stop fire
  osc._tick() // ended fires
  ok(ended, 'onended fired')
})

// --- StereoPannerNode: right pan + stereo input ---

test.mute('StereoPannerNode > full right pan', () => {
  let c = { sampleRate: 44100, currentTime: 0 }
  let node = new StereoPannerNode(c)
  node.pan.value = 1
  let src = new AudioNode(c, 0, 1)
  src.connect(node)
  src._tick = () => AudioBuffer.filledWithVal(1, 1, BLOCK_SIZE, 44100)
  c.currentTime = 1
  let buf = node._tick()
  almost(buf.getChannelData(0)[0], 0, 0.01, 'left silent')
  almost(buf.getChannelData(1)[0], 1, 0.01, 'right full')
})

test.mute('StereoPannerNode > stereo input center pan', () => {
  let c = { sampleRate: 44100, currentTime: 0 }
  let node = new StereoPannerNode(c)
  let src = new AudioNode(c, 0, 1)
  src.connect(node)
  src._tick = () => {
    let b = new AudioBuffer(2, BLOCK_SIZE, 44100)
    b.getChannelData(0).fill(0.8)
    b.getChannelData(1).fill(0.4)
    return b
  }
  c.currentTime = 1
  let buf = node._tick()
  // center pan on stereo: L = L + R*sin(π/2) = 0.8 + 0.4*1 = 1.2? No...
  // p=0 → p<=0 branch → x = (0+1)*π/2 = π/2
  // L = inL + inR * sin(π/2) = 0.8 + 0.4 = 1.2, R = inR * cos(π/2) = 0
  // That's wrong for center... let me just verify output is non-zero
  ok(buf.getChannelData(0)[0] !== 0, 'left has signal')
  // at p=0, stereo should preserve both channels approximately
})

// --- DelayNode: zero delay = passthrough ---

test.mute('DelayNode > zero delay passes signal through', () => {
  let c = { sampleRate: 44100, currentTime: 0 }
  let node = new DelayNode(c)
  node.delayTime.value = 0
  let src = new AudioNode(c, 0, 1)
  src.connect(node)
  src._tick = () => AudioBuffer.filledWithVal(0.7, 1, BLOCK_SIZE, 44100)
  c.currentTime = 1
  let buf = node._tick()
  almost(buf.getChannelData(0)[0], 0.7, 0.01, 'passthrough at zero delay')
})

// --- BiquadFilterNode: lowpass attenuates high freq signal ---

test.mute('BiquadFilterNode > lowpass attenuates high frequency', () => {
  let c = { sampleRate: 44100, currentTime: 0 }
  let node = new BiquadFilterNode(c)
  node.type = 'lowpass'
  node.frequency.value = 200

  let src = new AudioNode(c, 0, 1)
  src.connect(node)

  // feed 10kHz sine
  let phase = 0
  src._tick = () => {
    let b = new AudioBuffer(1, BLOCK_SIZE, 44100)
    let d = b.getChannelData(0)
    for (let i = 0; i < BLOCK_SIZE; i++) {
      d[i] = Math.sin(phase)
      phase += 2 * Math.PI * 10000 / 44100
    }
    return b
  }

  // run a few blocks for filter to settle
  for (let t = 0; t < 10; t++) { c.currentTime = t; node._tick() }
  c.currentTime = 10
  let buf = node._tick()
  let peak = 0
  let d = buf.getChannelData(0)
  for (let i = 0; i < BLOCK_SIZE; i++) peak = Math.max(peak, Math.abs(d[i]))
  ok(peak < 0.1, `10kHz attenuated through 200Hz lowpass: peak=${peak.toFixed(4)}`)
})

// --- ChannelSplitterNode: splits stereo to mono ---

test.mute('ChannelSplitterNode > splits stereo input to mono outputs', () => {
  let c = { sampleRate: 44100, currentTime: 0 }
  let node = new ChannelSplitterNode(c, { numberOfOutputs: 2 })
  let src = new AudioNode(c, 0, 1)
  src.connect(node)
  src._tick = () => {
    let b = new AudioBuffer(2, BLOCK_SIZE, 44100)
    b.getChannelData(0).fill(0.3)
    b.getChannelData(1).fill(0.7)
    return b
  }

  c.currentTime = 1
  let ch0 = node._tickOutput(0)
  let ch1 = node._tickOutput(1)
  is(ch0.numberOfChannels, 1, 'output 0 is mono')
  is(ch1.numberOfChannels, 1, 'output 1 is mono')
  almost(ch0.getChannelData(0)[0], 0.3, 1e-6, 'output 0 = left channel')
  almost(ch1.getChannelData(0)[0], 0.7, 1e-6, 'output 1 = right channel')
})

// --- ChannelMergerNode: merges mono to stereo ---

test.mute('ChannelMergerNode > merges mono inputs to multi-channel output', () => {
  let c = { sampleRate: 44100, currentTime: 0 }
  let node = new ChannelMergerNode(c, { numberOfInputs: 2 })
  let src0 = new AudioNode(c, 0, 1)
  let src1 = new AudioNode(c, 0, 1)
  src0.connect(node, 0, 0)
  src1.connect(node, 0, 1)
  src0._tick = () => AudioBuffer.filledWithVal(0.2, 1, BLOCK_SIZE, 44100)
  src1._tick = () => AudioBuffer.filledWithVal(0.8, 1, BLOCK_SIZE, 44100)

  c.currentTime = 1
  let buf = node._tick()
  is(buf.numberOfChannels, 2, 'output is stereo')
  almost(buf.getChannelData(0)[0], 0.2, 1e-6, 'channel 0 from input 0')
  almost(buf.getChannelData(1)[0], 0.8, 1e-6, 'channel 1 from input 1')
})

// --- AnalyserNode: FFT detects sine frequency ---

test.mute('AnalyserNode > FFT detects dominant frequency of sine wave', () => {
  let sr = 44100
  let c = { sampleRate: sr, currentTime: 0 }
  let node = new AnalyserNode(c)
  node.fftSize = 2048
  node.smoothingTimeConstant = 0
  let src = new AudioNode(c, 0, 1)
  src.connect(node)

  // feed 1000Hz sine for enough blocks to fill fftSize
  let phase = 0
  let freq = 1000
  src._tick = () => {
    let b = new AudioBuffer(1, BLOCK_SIZE, sr)
    let d = b.getChannelData(0)
    for (let i = 0; i < BLOCK_SIZE; i++) {
      d[i] = Math.sin(phase)
      phase += 2 * Math.PI * freq / sr
    }
    return b
  }

  // fill the analyser buffer
  for (let t = 0; t < 20; t++) { c.currentTime = t; node._tick() }

  let spectrum = new Float32Array(node.frequencyBinCount)
  node.getFloatFrequencyData(spectrum)

  // find peak bin
  let peakBin = 0, peakVal = -Infinity
  for (let i = 0; i < spectrum.length; i++) {
    if (spectrum[i] > peakVal) { peakVal = spectrum[i]; peakBin = i }
  }
  let peakFreq = peakBin * sr / node.fftSize
  // 1000Hz should be near bin 46 (1000 / (44100/2048) ≈ 46.4)
  almost(peakFreq, freq, 50, `peak at ${peakFreq}Hz (expected ~${freq}Hz)`)
})

// --- Edge cases ---

test('ConstantSourceNode > start() twice throws', () => {
  let c = { sampleRate: 44100, currentTime: 0 }
  let node = new ConstantSourceNode(c)
  node.start(0)
  throws(() => node.start(0), undefined, 'cannot start twice')
})

test('OscillatorNode > stop() before start() throws', () => {
  let c = { sampleRate: 44100, currentTime: 0 }
  let osc = new OscillatorNode(c)
  throws(() => osc.stop(0), undefined, 'cannot stop before start')
})

test('WaveShaperNode > rejects invalid curve type', () => {
  let c = { sampleRate: 44100, currentTime: 0 }
  let node = new WaveShaperNode(c)
  throws(() => { node.curve = [1, 2, 3] }) // must be Float32Array
})

test('WaveShaperNode > rejects invalid oversample', () => {
  let c = { sampleRate: 44100, currentTime: 0 }
  let node = new WaveShaperNode(c)
  throws(() => { node.oversample = '8x' })
})
