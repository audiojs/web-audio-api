# web-audio-api

- [x] ~~CLI interface — `npx waa "..."` or piping?~~ not worth it, use audio

- [ ] Compile kernels with jz
- [ ] #16 DSP in separate thread (Worker + SharedArrayBuffer)

### Phase 1: toolchain
1. jz build pipeline, WASM compilation
2. JS ↔ WASM interface (audio buffer passing, param data)
3. Feature detection — WASM when available, JS fallback

### Phase 2: hot-path kernels (by CPU cost)
1. ConvolverNode — FFT convolution
2. BiquadFilterNode — per-sample IIR
3. OscillatorNode — waveform generation
4. DynamicsCompressorNode — envelope + gain
5. IIRFilterNode, AnalyserNode FFT, channel mixing, AudioParam automation

### Phase 3: graph engine
1. Graph traversal in WASM (no JS↔WASM boundary per node)
2. Buffer pool in WASM memory
3. SIMD vectorized DSP

### Phase 4: validation
1. Bit-exact JS vs WASM comparison
2. Performance benchmarks (latency, throughput, memory)
3. Stress tests (large graphs, long sessions, real-time)

## Future

- AI agents + audio: agents know Web Audio from MDN training data → this makes it work in CLI
- Agent skill: audio remastering, sound generation, preprocessing for transcription
- Isomorphic audio: share graph definitions between browser and server
- Audio as function: OfflineAudioContext = pure function (graph in → buffer out)
- Agent / script for updating to match the standard


## Archive

- [x] Consider inlining `automation-events` — brings `@babel/runtime` + `tslib` (runtime polyfills for Node 18+ target); the most complex AudioParam code is workarounds for this library; ~200 lines to inline
  - [x] Fix `AudioParam.#getValue` upstream — move exponential ramp opposite-sign fix into `automation-events` instead of wrapping in AudioParam
  - [x] Fix `cancelAndHoldAtTime` upstream — precision truncation fix (60 lines) compensates for `automation-events` float32 resampling; fix in library, remove workaround
- [x] Delete `.travis.yml` — dead CI config from 0.x era (Node 4-7), replaced by GitHub Actions
- [x] Complete `index.d.ts` — OfflineAudioContext suspend/resume, AudioContext setSinkId/getOutputTimestamp/sinkId/stats/renderQuantumSize, AudioListener/PannerNode AudioParam getters, AudioParam automationRate/minValue/maxValue, MediaStreamAudioSourceNode.mediaStream, OfflineAudioContext options dict, PeriodicWave spec constructor, MediaElementAudioSourceNode, AudioWorkletNode.onprocessorerror
- [x] Add project AGENTS.md — test commands, WPT invariant, float precision rules, rendering contract, cycle detection flow
- [x] Delete dead `FloatPoint3D` methods — `cross()`, `add()`, `sub()`, `mul()`, `toArray()`, `normSquared()`; inlined `distanceTo()` math; also deleted unused allocating `sub()` by fixing ConeEffect
- [x] Delete dead velocity — `PannerNode.setVelocity()`, `PannerNode._velocity`, `AudioListener._velocity`, `AudioListener.velocity` getter
- [x] Inline `PannerProvider` into `PannerNode` — deleted PannerProvider.js, moved panningModel enum validation into PannerNode
- [x] Fix `ConeEffect.gain()` allocation — accepts scratch FloatPoint3D param, PannerNode passes `_s7`
- [x] Add `"sideEffects": false` to `package.json`
- [x] `AudioWorklet.addModule` `with` statement — documented why `with` is required (live currentTime/currentFrame getters) and why alternatives are worse
- [x] `ScriptProcessorNode.onaudioprocess` — documented _tick replacement pattern and why it exists
- [x] `index.js` `makeEnumerable` loop — added comment explaining which classes need it and when to add new ones
- [x] `AudioContext._renderLoop` error handling — documented silent stop behavior
- [x] Examples (`examples/` directory)
- [x] Benchmarks — comparative benchmarks against alternatives
- [x] Modularization — extract standalone DSP modules (see below)

### Modularization

Extractable standalone modules (each useful outside Web Audio API):

- [x] **biquad-coefficients** — covered by `digital-filter/iir/biquad.js` (v2.3.0)
- [x] **pcm-encode** — covered by `pcm-convert` (v3.1.1)
- [x] **channel-mixing** — already covered by `audio-buffer/util.remix` (all 12 W3C speaker cases correct)
- [~] **spatial-audio** — not worth extracting; no external consumer
- [x] **periodic-wave** — covered by `periodic-function/wavetable.js` (v2.0.0); `PeriodicWave.buildTable` delegates to it
- [~] **dynamics-compressor** — not an audio filter; keep inline (no external consumer)
- [x] **iir-filter** — covered by `digital-filter/core/iir.js` (v2.3.0)

Principle: WAA imports these as deps. Each works standalone. Graph infrastructure stays in WAA.

#### Spec compliance
- [x] 100% WPT (4300/4300 tests)
- [x] All 26 audio node types
- [x] Sub-sample accurate scheduling
- [x] AudioWorklet with URL loading + MessagePort
- [x] Full AudioParam automation (ramps, curves, cancelAndHold)
- [x] Channel mixing (speakers/discrete) per spec
- [x] OfflineAudioContext suspend/resume
- [x] Polyfill entry (`import 'web-audio-api/polyfill'`)
- [x] Auto-detect speaker output

#### Cleanup
- [x] PannerNode FloatPoint3D scratch objects (eliminated per-sample allocations)
- [x] Dead code removed (EqualPowerPanner.js, Panner.js)
- [x] Cycle detection structured (`context._cycle`)
- [x] ConvolverNode prodRe/prodIm pre-allocated
- [x] ConeEffect.innerAngle bug fixed
- [x] fpCeil extracted to constants.js
- [x] PeriodicWave spec reference (W3C §1.31)
- [x] DistanceEffect/ConeEffect → #private fields
- [x] _dsp(offset, count) — eliminated temporal coupling
- [x] Deno CI: `node:` prefix imports
- [x] Bun CI: MP3 decode CRC graceful skip

#### Deferred (acceptable as-is)
- [~] audio-buffer._channels internal access — no public API for buffer replacement
- [~] AudioBufferSourceNode _outBuf — callers hold references across quanta
- [x] WPT runner split — functional at 100%, 22s runtime
- [~] _outBuf base class convention — consistent enough without abstraction
- [~] Automatic _tailNodes — explicit registration is clearer

#### Blindspots — addressed
- [x] Performance ceiling → README Limitations + WASM planned
- [x] outStream non-standard → README + auto-detect
- [x] Browser-only WPT → 100% via shimming
- [x] AudioWorklet threading → README Limitations

#### GitHub issues — all closed except #16
- [x] All 49 issues closed with answers and code examples. #16 (Worker/WASM) kept open for milestone 2.

## Examples

Runnable files grounded in MDN tutorials. Self-contained, no browser, no DOM.

### Getting started
- [x] **speaker.js** — Hello world. AudioContext + OscillatorNode → speaker.
- [x] **pipe-stdout.js** — Pipe to system: `node pipe-stdout.js | aplay -f cd`.

### Offline rendering
- [x] **render-to-buffer.js** — OfflineAudioContext → OscillatorNode → AudioBuffer → raw PCM.
- [x] **process-file.js** — readFile → decodeAudioData → BiquadFilter + DynamicsCompressor → render.

### Synthesis
- [x] **sweep.js** — OscillatorNode + PeriodicWave + GainNode envelope (linearRamp).
- [x] **subtractive-synth.js** — Sawtooth → BiquadFilter (lowpass sweep) → GainNode (ADSR).
- [x] **noise.js** — Procedural white noise → BiquadFilter (bandpass) → shaped noise.
- [x] **lfo.js** — Sine carrier + square LFO → gain modulation = tremolo.

### Spatial
- [x] **spatial.js** — PannerNode + AudioListener + positionX automation → stereo render.

### Analysis
- [x] **fft.js** — AnalyserNode → getFloatFrequencyData → print spectrum.

### Advanced
- [x] **worklet.js** — AudioWorkletProcessor white noise generator with custom param.
- [x] **linked-params.js** — ConstantSourceNode controlling multiple GainNodes.
- [x] **sequencer.js** — Multi-voice step sequencer with currentTime-based scheduling.
