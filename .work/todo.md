## [x] Cleanup / perf pass

1. [x] PannerNode per-sample object allocations — 7 scratch FloatPoint3D, mutating methods
2. [x] Dead code — deleted EqualPowerPanner.js, Panner.js, simplified PannerProvider
3. [x] Cycle detection — extracted to `context._cycle` structured object
4. [~] Reaching into dependency internals — fixed AudioContext._render(); audio-buffer._channels kept (no public API)
5. [x] ConvolverNode hot-path allocations — prodRe/prodIm pre-allocated in #initConvState
6. [~] AudioBufferSourceNode _outBuf — kept as-is (callers hold references across quanta)
7. [x] ConeEffect.innerAngle bug — removed broken normalization
8. [~] WPT runner split — deferred (functional, 100% pass rate, 22s runtime)
9. [x] fpCeil duplication — moved to constants.js
10. [x] PeriodicWave sign convention — W3C §1.31 spec reference added

Extra cleanup:
- [x] DistanceEffect/ConeEffect #private properties — converted both
- [x] _activeBlockSize/_blockStartOffset → {offset, count} arg to _dsp() — eliminated temporal coupling
- [~] _outBuf convention in AudioNode base — pattern is consistent enough, not worth abstracting
- [~] Automatic _tailNodes registration — explicit registration is clearer
- [x] Deno CI: bare `fs`/`path`/`url`/`vm` imports → `node:` prefix
- [x] Bun CI: MP3 decode CRC issue in audio-decode dependency — graceful skip

## [x] Make it work

* [x] Change proposition layer: The proposition of pure JavaScript is not the value I am pursuing. As you see in the plan there's WASM version, can be potentially made with JZ - subset of JS compiling into WASM.
We need to reframe value proposition into something more reliable, like fixing the platform gap or something like that
* [x] All issues in github — triaged below

## GitHub issues triage

### Fixed by phase4 (close these)
- [x] #85 Use EventTarget instead EventEmitter — done (Emitter mixin extends EventTarget)
- [x] #82 Next (v1): making complete compatible API — done (100% WPT, v1.0.0)
- [x] #78 decodeAudioData throw error 'Maximum call stack size exceeded' — fixed (audio-decode replaces old decoder)
- [x] #77 copyFromChannel is NOT in AudioBuffer.js — fixed (audio-buffer v6)
- [x] #76 m4a demuxer incomplete — fixed (audio-decode handles 12+ formats)
- [x] #75 Array buffer allocation failed while trying to decode large files — fixed (audio-decode)
- [x] #73 decodeAudioData throws decoded data as error — fixed (Promise-based)
- [x] #93 decodeAudioData doesn't return a Promise — fixed
- [x] #67 OscillatorNode (coming soon) — done
- [x] #66 createBiquadFilter is not a function — done
- [x] #63 createMediaStreamSource is not a function — done (MediaStreamAudioSourceNode)
- [x] #58 Implement copyFromChannel/copyToChannel — done (audio-buffer v6)
- [x] #57 AudioBufferSourceNode.start() fails silently — fixed
- [x] #54 big cleaning — done (complete rewrite)
- [x] #53 Specifying AudioContext sample rate — done (constructor option)
- [x] #46 Feature request: createAnalyser() — done (AnalyserNode)
- [x] #31 Use native es6 if available — done (ESM, #private fields)
- [x] #24 test against W3C test suite — done (100% WPT)
- [x] #23 ES6 refactoring — done
- [x] #18 Implement DynamicsCompressorNode — done
- [x] #15 decodeAudioData support for more formats — done (audio-decode: 12+ formats)
- [x] #14 decodeAudioData should perform all steps described in the spec — done
- [x] #10 sample-precise scheduling — done (sub-sample accurate)
- [x] #9 Handle setting .value properly — done (AudioParam spec-compliant)

### Still relevant
- [x] #94 How to clear AudioContext?
  Answer: `await ctx.close()` closes and releases. `using ctx = new AudioContext()` auto-disposes.
  Action: close with answer, add to README FAQ.
- [x] #88 OfflineAudioContext for Tone.js
  Answer: `OfflineAudioContext` is fully implemented. `Tone.setContext(new AudioContext())` works.
  Action: close with answer + example.
- [x] #72 Polyfill entry — `globalThis.AudioContext ??= (await import('web-audio-api')).AudioContext`
  Action: add `polyfill.js` entry, close issue.
- [x] #60 1.0 release — all core items done. Close with summary.
  Original #60 checklist assessment:
  - [x] use audio-buffer — done (audio-buffer v6)
  - [x] port to commonjs — superseded: ESM is the standard now
  - [x] common browser/node interface — done (polyfill.js + same API)
  - [~] use audio-buffer-remix — not needed. Our ChannelMixing.js is spec-compliant (speakers/discrete),
    cached per topology, and handles all W3C mixing rules. audio-buffer-remix is a simpler utility
    that doesn't cover the spec's channel interpretation modes. Keep ChannelMixing.
  - [ ] audio-speaker as default outStream — worth doing. Auto-detect and use audio-speaker when no
    outStream is set, with lazy import to avoid mandatory dependency. Would remove the biggest friction
    point ("you need to set outStream"). Deferred to post-1.0.
  - [x] pcm-boilerplate vs pcm-util — resolved: both replaced with DataView-based BufferEncoder (zero deps)
  - [~] audio-biquad extraction — not needed now. Our BiquadFilterNode._coefficients() is self-contained
    (Audio EQ Cookbook). Extracting to a separate package would help standalone filter use cases but
    adds dep management. Consider for milestone 2 (extractable DSP kernels).
  - [x] get rid of underscore — done (never had it in phase4; all native array methods)
  - [~] pull-stream/functional interfaces — not applicable. We implement the W3C spec API, not audiojs
    streaming conventions. The OfflineAudioContext "graph in → buffer out" IS the functional interface.
  - [x] @audiojs infra — GitHub Actions CI (replaces Travis), npm audit (replaces Greenkeeper),
    100% WPT (replaces ad-hoc test suite). No ESLint — code style enforced by convention.
  - [x] W3C test suite — done: 100% WPT (4300/4300)

### Outdated / not applicable (close with note)
- [x] #92 Latest version? — v1.0.0 incoming
- [x] #91 .coffee files — CoffeeScript removed long ago
- [x] #90 Creating audio server — usage question, answer in docs
- [x] #89 Is AudioBuffer too huge? — fixed with audio-buffer v6
- [x] #80 Creating the same data as Web API — done (spec-compliant)
- [x] #79 Modifying incoming MediaStream — MediaStreamAudioSourceNode implemented
- [x] #74 Do you have any plan to continue? — yes, v1.0.0
- [x] #71 Does not build with node 12 — requires node 18+
- [x] #70 How do i analyse audio from URL? — AnalyserNode + fetch
- [x] #69 coreaudio buffer underflow — native dep removed
- [x] #68 Is this project abandoned? — no
- [x] #56 Cannot find sound card — native dep removed
- [x] #55 React native — works via pure JS, no native deps
- [x] #49 Microphone level — use MediaStreamAudioSourceNode
- [x] #48 Enhance README examples — done
- [x] #35 Capturing audio — MediaStreamAudioDestinationNode
- [x] #13 Number of channels = 0 should be valid — spec says ≥1, throws NotSupportedError
- [x] #12 Decouple event scheduling from dsp tick — done (DspObject)
- [x] #6 AudioParam out of the library — kept in (spec requirement)
- [x] #5 How to calculate computedNumberOfChannels — done (spec-compliant in audioports.js)
- [x] #4 Mixing with inputs — done (AudioParam modulation)

## [ ] Benchmarks: faster than any alternative

## [ ] Modularization

**`biquad-coefficients`** — Audio EQ Cookbook coefficient computation
- Source: `BiquadFilterNode._coefficients()` (static, ~100 lines)
- API: `coefficients(type, frequency, sampleRate, Q, gain) → {b0, b1, b2, a1, a2}`
- 8 filter types: lowpass, highpass, bandpass, lowshelf, highshelf, peaking, notch, allpass
- Use cases: any audio/music app needing filter design without Web Audio
- Zero dependencies. Pure math.

**`pcm-encode`** — PCM buffer encoding
- Source: `BufferEncoder` in `utils.js` (~40 lines)
- API: `encode(channels, {bitDepth, sampleRate, endianness}) → Uint8Array`
- Supports 8/16/24/32-bit int + 32-bit float, LE/BE
- Uses DataView — works everywhere (Node, Deno, Bun, browser)
- Zero dependencies. Replaces pcm-convert/pcm-util.

**`channel-mixing`** — W3C-compliant audio channel mixing
- Source: `ChannelMixing.js` (~130 lines)
- API: `mix(inputBuffer, outputBuffer)` with speaker/discrete interpretation
- Handles all standard mixes: mono↔stereo, stereo↔5.1, arbitrary N→M
- Use cases: any multi-channel audio processing
- Only dependency: block size constant (parameterizable).

**`spatial-audio`** — 3D audio positioning math
- Sources: `FloatPoint3D.js` + `DistanceEffect.js` + `ConeEffect.js` (~280 lines)
- API: distance models (linear/inverse/exponential), cone attenuation, vector math
- Use cases: game audio, VR, spatial audio outside Web Audio
- Zero dependencies.

**`periodic-wave`** — Fourier synthesis wavetable generation
- Source: `PeriodicWave.buildTable()` (~40 lines)
- API: `buildTable(real, imag, normalize) → Float32Array`
- Built-in waveforms: sine, square, sawtooth, triangle
- Use cases: synth engines, waveform generation
- Depends on: fourier-transform (for potential future use), but the core is pure math.

**`dynamics-compressor`** — audio compression algorithm
- Source: `DynamicsCompressorNode._tick()` DSP loop (~30 lines)
- API: `compress(samples, {threshold, knee, ratio, attack, release}) → samples`
- Envelope follower + soft knee + gain reduction
- Use cases: audio normalization, mastering, loudness control

**`iir-filter`** — IIR filter + frequency response
- Source: `IIRFilterNode._tick()` DSP + `getFrequencyResponse()` (~50 lines)
- Direct Form II Transposed, Float64 coefficients
- `getFrequencyResponse(freqHz) → {magnitude, phase}`
- Use cases: custom filter design, audio analysis

### Extraction strategy

Principle: WAA imports these as deps. Each module works standalone.
The graph infrastructure (AudioNode, AudioParam, audioports) stays in WAA — that IS the framework.

## [ ] CLI interface — `npx web-audio-api eval "..."` or piping. Nice-to-have, not blocking.

## [x] BLINDSPOTS — addressed

* [x] Performance ceiling — acknowledged in README Limitations. WASM kernels planned for milestone 2.
* [x] outStream is non-standard — acknowledged in README. Auto-detect reduces friction (speaker → stdout fallback).
* [x] Browser-only WPT tests — resolved: 100% WPT via shimming (iframe, MediaElement, Worker stubs in runner).
* [~] Maintenance load — WPT evolves. 100% requires ongoing effort. Tracked in CI.
* [x] AudioWorklet isolation — acknowledged in README Limitations. Synchronous is functionally correct.

## [ ] Extra value

* [ ] Extractable DSP kernels: Each node's _dsp() function is a standalone algorithm — biquad filter, FFT, convolution, dynamics compression. These could become independent modules.
* [ ] Isomorphic audio: Write audio processing once, run it on client and server. Share audio graph definitions between browser and Node.js.
* [ ] Audio as function: OfflineAudioContext turns audio processing into a pure function: graph in → buffer out. Perfect for serverless.

## [ ] Use cases

0. Speaker output — real-time playback via speaker/stdout
1. Offline rendering — graph in → buffer out (OfflineAudioContext)
2. Audio file processing — decode → effects chain → render
3. Sound synthesis — oscillators + filters + automation → buffer
4. Audio testing — test Web Audio code in CI without a browser
5. Audio analysis — FFT, spectral features, metering
6. Stream processing — real-time effects on audio streams
7. Other integration cases?

## [ ] Examples (examples/)

  Grounded in MDN tutorials + real npm usage. Each is self-contained, no browser, no DOM.

  The best format is runnable files — they prove the code works. No examples.md intermediary.

  ```
  examples/
    speaker.js        # node examples/speaker.js
    sweep.js           # node examples/sweep.js | aplay -f cd
    process-file.js    # node examples/process-file.js input.mp3 | aplay -f cd
    ...
  ```

  Each file: ~20-30 lines, self-contained, commented header explaining what it does. Output is either raw PCM to stdout (pipe to aplay/sox/ffmpeg) or data to console (analysis examples). The Unix way — composable.

  The files themselves ARE the documentation. An agent reads the file, understands the pattern, copies it. A developer runs it, hears the result.

  The examples in THIS project should be spec patterns, not convenience wrappers. They demonstrate "here's what the Web Audio API can do outside a browser" — not "here's our easier API for audio processing."

  ### Getting started
  - [ ] **speaker.js** — Hello world. AudioContext + Speaker + OscillatorNode.
        Source: README pattern, original project purpose.
  - [ ] **pipe-stdout.js** — Pipe audio to system: `node example.js | aplay -f cd`.
        Source: README pattern.

  ### Offline rendering (the killer feature)
  - [ ] **render-to-buffer.js** — OfflineAudioContext → OscillatorNode → AudioBuffer → write raw PCM.
        The "audio as function" pattern. Graph in → buffer out.
  - [ ] **process-file.js** — readFile → decodeAudioData → BiquadFilter (highpass 80Hz) + DynamicsCompressor → render → write.
        Source: MDN "dial-up" sample loading + real Descript/web-audio-engine usage.

  ### Synthesis (MDN "Advanced techniques" patterns)
  - [ ] **sweep.js** — OscillatorNode + PeriodicWave (custom waveform) + GainNode envelope (attack/release via linearRamp).
        Source: MDN "Advanced techniques" sweep pattern.
  - [ ] **subtractive-synth.js** — Sawtooth → BiquadFilter (lowpass, frequency sweep) → GainNode (ADSR via setValueAtTime + exponentialRamp).
        Source: MDN simple synth keyboard + advanced techniques.
  - [ ] **noise.js** — Procedural AudioBuffer (Math.random white noise) → BiquadFilter (bandpass) → shaped noise.
        Source: MDN "Advanced techniques" noise pattern.
  - [ ] **lfo.js** — Two oscillators: OscillatorNode (sine carrier) + OscillatorNode (square LFO → gain modulation) = tremolo/pulse.
        Source: MDN "Advanced techniques" pulse pattern.

  ### Spatial audio
  - [ ] **spatial.js** — PannerNode (HRTF/equalpower) + AudioListener + positionX automation (source moving L→R) → stereo OfflineAudioContext render.
        Source: MDN "Web audio spatialization basics".

  ### Analysis
  - [ ] **fft.js** — decodeAudioData → AnalyserNode + ScriptProcessorNode → extract getFloatFrequencyData per quantum → print spectrum.
        Source: MDN "Visualizations with Web Audio API", adapted for server-side (no canvas, raw data output).

  ### Advanced
  - [ ] **worklet.js** — AudioWorkletProcessor that generates white noise (simplest custom processor). Register + connect + render.
        Source: MDN "Background audio processing using AudioWorklet".
  - [ ] **linked-params.js** — ConstantSourceNode controlling multiple GainNodes simultaneously (chord with linked volumes).
        Source: MDN "Controlling multiple parameters with ConstantSourceNode".
  - [ ] **sequencer.js** — Multi-voice step sequencer: sweep + noise + sample voices, currentTime-based lookahead scheduling.
        Source: MDN "Advanced techniques" sequencer pattern. Demonstrates precise timing without requestAnimationFrame.

  ### References
  - MDN Web Audio guides: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
  - MDN examples repo: https://github.com/mdn/webaudio-examples/
  - Descript fork (real server-side usage): https://github.com/descriptinc/web-audio-js


## [ ] AI agents + audio: real or fictional?

  Honest answer: the near use case is simpler than you think. Agents already know the Web Audio API from training data (MDN is heavily represented). This project makes that existing knowledge work in CLI. An agent asked to "generate a 440Hz tone" or "apply a lowpass filter to this file" can write standard Web Audio code and run it immediately.

  Concrete contexts where this is real today:

  Agent generates notification/alert sounds — synth a tone, save to file
  Agent preprocesses audio for transcription — highpass filter, normalize
  Agent analyzes audio — "what frequencies are dominant in this file?"
  Agent tests audio code — write Web Audio graph, verify output in CI
  The deeper question — "teach agents to be audio engineers" — is aspirational. That's not about this project, that's about agent capabilities + training data.

  **Agent Skill to remaster your audio**



## [ ] Milestone 2 (make it fast) — jz / WASM DSP

Goal: rewrite performance-critical DSP kernels in jz, compile to WASM, maintain pure-JS fallbacks.

- [ ] #16 DSP in separate thread — future milestone (WASM/Worker). Keep open, tag milestone-2.

### Phase 1: jz setup

1. jz toolchain integration — build pipeline, WASM compilation
2. JS ↔ WASM interface design — audio buffer passing (SharedArrayBuffer or copy), param automation data transfer
3. Feature detection — auto-select WASM when available, JS fallback otherwise

### Phase 2: Hot-path kernels

Priority by CPU cost (highest first):

1. **ConvolverNode** — FFT-based convolution, most compute-intensive node
2. **BiquadFilterNode** — per-sample IIR filtering, very hot in typical audio graphs
3. **OscillatorNode** — waveform generation, phase accumulation
4. **DynamicsCompressorNode** — envelope detection, gain computation
5. **IIRFilterNode** — general IIR filtering
6. **FFT for AnalyserNode** — spectral analysis
7. **Channel mixing** — up/down mixing in audioports
8. **AudioParam automation** — sample-accurate interpolation

### Phase 3: Audio graph engine

1. **Graph traversal in WASM** — process ordered node list without JS ↔ WASM boundary per node
2. **Buffer pool** — pre-allocated audio buffers managed in WASM memory
3. **SIMD** — leverage WASM SIMD for vectorized DSP where supported

### Phase 4: Validation

1. Bit-exact output comparison: JS vs WASM paths
2. Performance benchmarks: latency, throughput, memory
3. Stress tests: large graphs, long-running sessions, real-time constraints
