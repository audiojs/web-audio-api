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

### Still relevant (keep open)
- [ ] #94 How to clear AudioContext? — needs docs: `ctx.close()` + `ctx[Symbol.dispose]()`
- [ ] #88 OfflineAudioContext for Tone.js — needs testing/docs
- [ ] #72 Polyfill entry — browser polyfill bundle not yet provided
- [ ] #60 1.0 release ideas/discussion — close after v1 publish
- [ ] #16 DSP graph should run in a different thread — future: WASM/Worker architecture

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

* [ ] Benchmarks: faster than any alternative
* [ ] Factor out modules: dsp/digital-filter?

## [ ] BLINDSPOTS — What am I not seeing?

* [ ] Performance ceiling — Pure JS will always be slower than Rust/native. Is this acknowledged honestly? At what graph complexity does it fall behind real-time? Users need to know.
* [ ] outStream is non-standard — The one API surface that ISN'T Web Audio spec. It's the escape hatch for output, but it breaks the "it's the same API" promise.
* [ ] Browser-only WPT tests — Some WPT tests require MediaElement, actual hardware audio output, etc. The ~1% gap isn't laziness, it's a fundamental environment limitation. This should be stated clearly.
* [ ] Maintenance load — WPT evolves. Browsers update. 99% today requires ongoing effort.
AudioWorklet isolation — In browsers, AudioWorklet runs in a separate thread. In this implementation, it runs synchronously. For most use cases that's fine, but it's a behavioral difference.

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

## [ ] Make it right

## [ ] Make it fast

## [ ] Milestone 2 — jz / WASM DSP

Goal: rewrite performance-critical DSP kernels in jz, compile to WASM, maintain pure-JS fallbacks.

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
