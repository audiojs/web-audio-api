# Changelog

#### 1.0.0

Complete rewrite. Pure JS Web Audio API for any JS runtime.

**Architecture:**
- EventEmitter → EventTarget (cross-environment)
- Pull-based graph with buffer reuse (zero alloc in hot paths)
- DSP kernels separated from graph plumbing for future WASM swap
- Emitter mixin shared between DspObject and AudioPort

**Nodes added (13):**
- ConstantSourceNode, OscillatorNode (wavetable + PeriodicWave)
- StereoPannerNode, DelayNode, BiquadFilterNode (8 types)
- WaveShaperNode (with 2x/4x oversampling), IIRFilterNode
- ConvolverNode, DynamicsCompressorNode
- ChannelSplitterNode, ChannelMergerNode, AnalyserNode (FFT)
- AudioScheduledSourceNode base class

**Dependencies replaced:**
- `av`, `aac`, `alac`, `flac`, `mp3` → `audio-decode` (WASM, 12+ formats)
- Internal AudioBuffer → `audio-buffer` v6 (enhanced upstream)
- `automation-events` 4.x → 7.x

**Infrastructure:**
- AudioContext: state machine (suspend/resume/close), onstatechange, baseLatency
- AudioParam: cancelScheduledValues, cancelAndHoldAtTime
- AudioNode: connect() chaining, full disconnect() overloads, validation hooks
- PCM encoder: cross-environment (ArrayBuffer + DataView, no Buffer)
- Tests: mocha/chai → tst (202 tests, 321k assertions)
- CI: Node 18/20/22

#### 0.2.2

- Removed `node-speaker` and `mathjs` dependencies

#### 0.2.1

- Now use aurora installed from npm

#### 0.2.0

- Refactored to ES6

#### 0.1.5

- AudioNode and AudioContext bug fixes

#### 0.1.0

- AudioContext (partial), AudioParam, AudioBufferSourceNode, GainNode
