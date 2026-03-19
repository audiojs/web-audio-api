# web-audio-api — roadmap

## Next up

- [ ] Examples (`examples/` directory)
- [ ] CLI interface — `npx web-audio-api eval "..."` or piping
- [ ] Benchmarks — comparative benchmarks against alternatives
- [ ] Modularization — extract standalone DSP modules (see below)

## Examples

Runnable files grounded in MDN tutorials. Self-contained, no browser, no DOM.

```
examples/
  speaker.js         # node examples/speaker.js
  pipe-stdout.js     # node examples/pipe-stdout.js | aplay -f cd
  render-to-buffer.js
  process-file.js
  sweep.js
  subtractive-synth.js
  noise.js
  lfo.js
  spatial.js
  fft.js
  worklet.js
  linked-params.js
  sequencer.js
```

### Getting started
- [ ] **speaker.js** — Hello world. AudioContext + OscillatorNode → speaker.
- [ ] **pipe-stdout.js** — Pipe to system: `node pipe-stdout.js | aplay -f cd`.

### Offline rendering
- [ ] **render-to-buffer.js** — OfflineAudioContext → OscillatorNode → AudioBuffer → raw PCM.
- [ ] **process-file.js** — readFile → decodeAudioData → BiquadFilter + DynamicsCompressor → render.

### Synthesis
- [ ] **sweep.js** — OscillatorNode + PeriodicWave + GainNode envelope (linearRamp).
- [ ] **subtractive-synth.js** — Sawtooth → BiquadFilter (lowpass sweep) → GainNode (ADSR).
- [ ] **noise.js** — Procedural white noise → BiquadFilter (bandpass) → shaped noise.
- [ ] **lfo.js** — Sine carrier + square LFO → gain modulation = tremolo.

### Spatial
- [ ] **spatial.js** — PannerNode + AudioListener + positionX automation → stereo render.

### Analysis
- [ ] **fft.js** — decodeAudioData → AnalyserNode → getFloatFrequencyData → print spectrum.

### Advanced
- [ ] **worklet.js** — AudioWorkletProcessor white noise generator.
- [ ] **linked-params.js** — ConstantSourceNode controlling multiple GainNodes.
- [ ] **sequencer.js** — Multi-voice step sequencer with currentTime-based scheduling.

## Modularization

Extractable standalone modules (each useful outside Web Audio API):

- [ ] **biquad-coefficients** — Audio EQ Cookbook. `coefficients(type, freq, sr, Q, gain) → {b0,b1,b2,a1,a2}`. ~100 lines, zero deps.
- [ ] **pcm-encode** — DataView-based PCM encoding. `encode(channels, format) → Uint8Array`. ~40 lines, zero deps.
- [ ] **channel-mixing** — W3C-compliant N→M channel mixing. speakers/discrete. ~130 lines.
- [ ] **spatial-audio** — FloatPoint3D + DistanceEffect + ConeEffect. ~280 lines, zero deps.
- [ ] **periodic-wave** — Fourier wavetable synthesis + built-in waveforms. ~40 lines.
- [ ] **dynamics-compressor** — Envelope follower + soft knee. ~30 lines.
- [ ] **iir-filter** — Direct Form II Transposed + frequency response. ~50 lines.

Principle: WAA imports these as deps. Each works standalone. Graph infrastructure stays in WAA.

## Milestone 2 — WASM DSP

Goal: rewrite hot-path DSP kernels in jz (JS subset → WASM), maintain pure-JS fallbacks.

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

## Ideas

- AI agents + audio: agents know Web Audio from MDN training data → this makes it work in CLI
- Agent skill: audio remastering, sound generation, preprocessing for transcription
- Isomorphic audio: share graph definitions between browser and server
- Audio as function: OfflineAudioContext = pure function (graph in → buffer out)

---

## Archive

### v1.0.0 — done

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
- [~] WPT runner split — functional at 100%, 22s runtime
- [~] _outBuf base class convention — consistent enough without abstraction
- [~] Automatic _tailNodes — explicit registration is clearer

#### Blindspots — addressed
- [x] Performance ceiling → README Limitations + WASM planned
- [x] outStream non-standard → README + auto-detect
- [x] Browser-only WPT → 100% via shimming
- [x] AudioWorklet threading → README Limitations

#### GitHub issues — all closed except #16
All 49 issues closed with answers and code examples. #16 (Worker/WASM) kept open for milestone 2.
