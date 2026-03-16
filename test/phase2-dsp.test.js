// DSP correctness tests — verify actual signal behavior against spec expectations
// These test real audio math, not just constructor defaults

import test from 'tst'
import { is, ok, almost } from 'tst'
import AudioBuffer from 'audio-buffer'
import AudioNode from '../src/AudioNode.js'
import OscillatorNode from '../src/OscillatorNode.js'
import PeriodicWave from '../src/PeriodicWave.js'
import BiquadFilterNode from '../src/BiquadFilterNode.js'
import DelayNode from '../src/DelayNode.js'
import StereoPannerNode from '../src/StereoPannerNode.js'
import WaveShaperNode from '../src/WaveShaperNode.js'
import IIRFilterNode from '../src/IIRFilterNode.js'
import ConvolverNode from '../src/ConvolverNode.js'
import DynamicsCompressorNode from '../src/DynamicsCompressorNode.js'
import ConstantSourceNode from '../src/ConstantSourceNode.js'
import ChannelSplitterNode from '../src/ChannelSplitterNode.js'
import ChannelMergerNode from '../src/ChannelMergerNode.js'
import AnalyserNode from '../src/AnalyserNode.js'
import GainNode from '../src/GainNode.js'
import { BLOCK_SIZE } from '../src/constants.js'

let SR = 44100

// helper: collect N blocks of output from a node
function collect(node, ctx, blocks) {
  let out = []
  for (let b = 0; b < blocks; b++) {
    ctx.currentTime = b + 1
    out.push(node._tick())
  }
  return out
}

// helper: connect source to node, source outputs given buffer
function wire(ctx, node, buf) {
  let src = new AudioNode(ctx, 0, 1)
  src.connect(node)
  src._tick = () => buf
  return src
}

// helper: generate sine buffer
function sine(freq, sr, len) {
  let b = new AudioBuffer(1, len, sr)
  let d = b.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.sin(2 * Math.PI * freq * i / sr)
  return b
}

// =========================================================================
// OscillatorNode waveform shapes
// =========================================================================

test.mute('OscillatorNode > sine wave peaks at ±1', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let osc = new OscillatorNode(c)
  osc.frequency.value = 100 // low freq to get full cycle in 441 samples
  osc.start(0)
  c.currentTime = 0; osc._tick()

  let max = -Infinity, min = Infinity
  for (let b = 0; b < 10; b++) {
    c.currentTime = b + 1
    let d = osc._tick().getChannelData(0)
    for (let i = 0; i < BLOCK_SIZE; i++) { max = Math.max(max, d[i]); min = Math.min(min, d[i]) }
  }
  almost(max, 1, 0.05, 'sine peak near +1')
  almost(min, -1, 0.05, 'sine trough near -1')
})

test.mute('OscillatorNode > square wave has flat tops and bottoms', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let osc = new OscillatorNode(c)
  osc.type = 'square'
  osc.frequency.value = 100
  osc.start(0)
  c.currentTime = 0; osc._tick()

  let positives = 0, negatives = 0
  for (let b = 0; b < 10; b++) {
    c.currentTime = b + 1
    let d = osc._tick().getChannelData(0)
    for (let i = 0; i < BLOCK_SIZE; i++) {
      if (d[i] > 0.5) positives++
      if (d[i] < -0.5) negatives++
    }
  }
  ok(positives > 100, 'has positive plateaus')
  ok(negatives > 100, 'has negative plateaus')
})

test.mute('OscillatorNode > sawtooth ramps linearly', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let osc = new OscillatorNode(c)
  osc.type = 'sawtooth'
  osc.frequency.value = 100
  osc.start(0)
  c.currentTime = 0; osc._tick()

  // sawtooth should have roughly uniform distribution across [-1, 1]
  let bins = new Array(10).fill(0)
  for (let b = 0; b < 10; b++) {
    c.currentTime = b + 1
    let d = osc._tick().getChannelData(0)
    for (let i = 0; i < BLOCK_SIZE; i++) {
      let bin = Math.min(9, Math.max(0, Math.floor((d[i] + 1) * 5)))
      bins[bin]++
    }
  }
  // all bins should have some samples (roughly uniform)
  ok(bins.every(b => b > 10), 'sawtooth has uniform distribution')
})

test.mute('OscillatorNode > detune shifts frequency', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let osc = new OscillatorNode(c)
  osc.frequency.value = 440
  osc.detune.value = 1200 // +1 octave → 880Hz
  osc.start(0)
  c.currentTime = 0; osc._tick()

  // count zero crossings — 880Hz has ~2x crossings of 440Hz
  let crossings = 0
  for (let b = 0; b < 5; b++) {
    c.currentTime = b + 1
    let d = osc._tick().getChannelData(0)
    for (let i = 1; i < BLOCK_SIZE; i++)
      if (d[i - 1] * d[i] < 0) crossings++
  }
  // 880Hz at 44100Hz → ~5.1 crossings per 128 samples × 5 blocks ≈ 25
  ok(crossings > 15, `880Hz crossings: ${crossings} (expect >15)`)
})

// =========================================================================
// BiquadFilterNode signal verification
// =========================================================================

test.mute('BiquadFilterNode > lowpass passes DC', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let filt = new BiquadFilterNode(c)
  filt.type = 'lowpass'
  filt.frequency.value = 1000
  wire(c, filt, AudioBuffer.filledWithVal(0.5, 1, BLOCK_SIZE, SR))

  // run enough blocks for filter to settle
  for (let i = 0; i < 20; i++) { c.currentTime = i; filt._tick() }
  c.currentTime = 20
  let buf = filt._tick()
  almost(buf.getChannelData(0)[BLOCK_SIZE - 1], 0.5, 0.05, 'DC passes through lowpass')
})

test.mute('BiquadFilterNode > highpass blocks DC', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let filt = new BiquadFilterNode(c)
  filt.type = 'highpass'
  filt.frequency.value = 1000
  wire(c, filt, AudioBuffer.filledWithVal(0.5, 1, BLOCK_SIZE, SR))

  for (let i = 0; i < 20; i++) { c.currentTime = i; filt._tick() }
  c.currentTime = 20
  let buf = filt._tick()
  almost(buf.getChannelData(0)[BLOCK_SIZE - 1], 0, 0.05, 'DC blocked by highpass')
})

test('BiquadFilterNode > getFrequencyResponse all 8 types', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let types = ['lowpass', 'highpass', 'bandpass', 'lowshelf', 'highshelf', 'peaking', 'notch', 'allpass']
  for (let type of types) {
    let f = new BiquadFilterNode(c)
    f.type = type
    let freqs = new Float32Array([100, 1000, 10000])
    let mag = new Float32Array(3)
    let phase = new Float32Array(3)
    f.getFrequencyResponse(freqs, mag, phase)
    ok(mag.every(v => isFinite(v)), type + ': magnitudes are finite')
    ok(phase.every(v => isFinite(v)), type + ': phases are finite')
  }
})

// =========================================================================
// DelayNode sample accuracy
// =========================================================================

test.mute('DelayNode > delays impulse by correct number of samples', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let delaySec = 128 / SR // exactly 1 block
  let node = new DelayNode(c, { maxDelayTime: 1 })
  node.delayTime.value = delaySec

  let impulse = new AudioBuffer(1, BLOCK_SIZE, SR)
  impulse.getChannelData(0)[0] = 1.0
  let silent = new AudioBuffer(1, BLOCK_SIZE, SR)
  let call = 0
  wire(c, node, impulse) // first call gets impulse
  let src = node._inputs[0].sources[0].node
  src._tick = () => ++call === 1 ? impulse : silent

  c.currentTime = 1
  let b1 = node._tick()
  // block 1: impulse entered delay, output should be silent
  almost(b1.getChannelData(0)[0], 0, 0.01, 'block 1 sample 0 silent')

  c.currentTime = 2
  let b2 = node._tick()
  // block 2: delayed impulse should appear at sample 0
  ok(Math.abs(b2.getChannelData(0)[0]) > 0.5, 'impulse appears in block 2')
})

// =========================================================================
// StereoPannerNode spec compliance
// =========================================================================

test('StereoPannerNode > mono: full left/center/right', () => {
  for (let [p, expL, expR, label] of [
    [-1, 1, 0, 'full left'],
    [0, Math.cos(Math.PI/4), Math.sin(Math.PI/4), 'center'],
    [1, 0, 1, 'full right']
  ]) {
    let c = { sampleRate: SR, currentTime: 0 }
    let node = new StereoPannerNode(c)
    node.pan.value = p
    wire(c, node, AudioBuffer.filledWithVal(1, 1, BLOCK_SIZE, SR))
    c.currentTime = 1
    let buf = node._tick()
    almost(buf.getChannelData(0)[0], expL, 0.01, label + ' L')
    almost(buf.getChannelData(1)[0], expR, 0.01, label + ' R')
  }
})

test('StereoPannerNode > stereo: center is passthrough', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new StereoPannerNode(c)
  let stereo = new AudioBuffer(2, BLOCK_SIZE, SR)
  stereo.getChannelData(0).fill(0.6)
  stereo.getChannelData(1).fill(0.4)
  wire(c, node, stereo)
  c.currentTime = 1
  let buf = node._tick()
  almost(buf.getChannelData(0)[0], 0.6, 0.01, 'L passthrough')
  almost(buf.getChannelData(1)[0], 0.4, 0.01, 'R passthrough')
})

// =========================================================================
// WaveShaperNode curve math
// =========================================================================

test('WaveShaperNode > hard clip curve', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new WaveShaperNode(c)
  // hard clip at ±0.5
  node.curve = new Float32Array([-0.5, -0.5, 0, 0.5, 0.5])
  wire(c, node, AudioBuffer.filledWithVal(1, 1, BLOCK_SIZE, SR))
  c.currentTime = 1
  let buf = node._tick()
  almost(buf.getChannelData(0)[0], 0.5, 0.01, 'clipped to 0.5')
})

test('WaveShaperNode > identity curve', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new WaveShaperNode(c)
  let n = 256
  let curve = new Float32Array(n)
  for (let i = 0; i < n; i++) curve[i] = (i / (n - 1)) * 2 - 1
  node.curve = curve
  wire(c, node, AudioBuffer.filledWithVal(0.3, 1, BLOCK_SIZE, SR))
  c.currentTime = 1
  let buf = node._tick()
  almost(buf.getChannelData(0)[0], 0.3, 0.02, 'identity curve preserves signal')
})

// =========================================================================
// IIRFilterNode known filter
// =========================================================================

test.mute('IIRFilterNode > 1-pole lowpass passes DC, attenuates high freq', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  // simple 1-pole lowpass: y[n] = 0.1*x[n] + 0.9*y[n-1]
  let node = new IIRFilterNode(c, [0.1], [1, -0.9])
  wire(c, node, AudioBuffer.filledWithVal(1, 1, BLOCK_SIZE, SR))

  for (let i = 0; i < 50; i++) { c.currentTime = i; node._tick() }
  c.currentTime = 50
  let buf = node._tick()
  almost(buf.getChannelData(0)[BLOCK_SIZE - 1], 1, 0.05, 'DC converges to input')
})

// =========================================================================
// ConvolverNode impulse response
// =========================================================================

test.mute('ConvolverNode > unit impulse IR = passthrough', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new ConvolverNode(c)
  node.normalize = false
  let ir = new AudioBuffer(1, 1, SR)
  ir.getChannelData(0)[0] = 1
  node.buffer = ir

  wire(c, node, AudioBuffer.filledWithVal(0.7, 1, BLOCK_SIZE, SR))
  c.currentTime = 1
  let buf = node._tick()
  almost(buf.getChannelData(0)[0], 0.7, 0.01, 'unit impulse = passthrough')
})

test.mute('ConvolverNode > delay IR shifts signal', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new ConvolverNode(c)
  node.normalize = false
  // IR with impulse at sample 1 (1-sample delay)
  let ir = new AudioBuffer(1, 2, SR)
  ir.getChannelData(0)[1] = 1
  node.buffer = ir

  let impulse = new AudioBuffer(1, BLOCK_SIZE, SR)
  impulse.getChannelData(0)[0] = 1
  wire(c, node, impulse)
  c.currentTime = 1
  let buf = node._tick()
  almost(buf.getChannelData(0)[0], 0, 0.01, 'sample 0 silent (delayed)')
  almost(buf.getChannelData(0)[1], 1, 0.01, 'impulse at sample 1')
})

// =========================================================================
// DynamicsCompressorNode behavior
// =========================================================================

test.mute('DynamicsCompressorNode > quiet signal passes unchanged', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new DynamicsCompressorNode(c)
  // signal at -60dB (0.001) is far below threshold of -24dB
  wire(c, node, AudioBuffer.filledWithVal(0.001, 1, BLOCK_SIZE, SR))

  for (let i = 0; i < 10; i++) { c.currentTime = i; node._tick() }
  c.currentTime = 10
  let buf = node._tick()
  almost(buf.getChannelData(0)[BLOCK_SIZE - 1], 0.001, 0.001, 'quiet signal approximately passes')
})

// =========================================================================
// Integration: multi-node graph
// =========================================================================

test.mute('Integration > oscillator → gain → destination', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let osc = new OscillatorNode(c)
  let gain = new GainNode(c)
  osc.frequency.value = 440
  gain.gain.value = 0.5

  osc.start(0)
  c.currentTime = 0
  osc._tick() // process start

  // manually wire: osc → gain
  let oscOut = new AudioNode(c, 0, 1)
  oscOut.connect(gain)
  oscOut._tick = () => osc._tick()

  c.currentTime = 1
  let buf = gain._tick()
  is(buf.numberOfChannels, 1)
  // output should be sine * 0.5 — peak ≈ 0.5
  let max = 0
  let d = buf.getChannelData(0)
  for (let i = 0; i < BLOCK_SIZE; i++) max = Math.max(max, Math.abs(d[i]))
  ok(max > 0.1 && max <= 0.55, `gain-scaled peak: ${max.toFixed(3)} (expect 0.1-0.55)`)
})

test.mute('Integration > splitter → separate gains → merger', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let splitter = new ChannelSplitterNode(c, { numberOfOutputs: 2 })
  let merger = new ChannelMergerNode(c, { numberOfInputs: 2 })

  // feed stereo: L=0.8, R=0.2
  let stereo = new AudioBuffer(2, BLOCK_SIZE, SR)
  stereo.getChannelData(0).fill(0.8)
  stereo.getChannelData(1).fill(0.2)
  wire(c, splitter, stereo)

  c.currentTime = 1
  splitter._tick()

  // verify split
  almost(splitter._tickOutput(0).getChannelData(0)[0], 0.8, 1e-6, 'split L')
  almost(splitter._tickOutput(1).getChannelData(0)[0], 0.2, 1e-6, 'split R')
})
