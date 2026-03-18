# web-audio-api roadmap

Pure JS Web Audio API for Node.js / serverless / edge runtimes.


## Reality check

### What exists

**Implemented nodes**: AudioContext (partial), AudioBuffer, AudioBufferSourceNode, GainNode, ScriptProcessorNode, PannerNode, AudioListener, AudioParam (with automation-events), AudioDestinationNode.

**Architecture**: Pull-based audio graph. DspObject → AudioNode → concrete nodes. AudioInput/AudioOutput ports with channel mixing. 128-sample BLOCK_SIZE ticks. PCM encoding to writable outStream.

**Tests**: 23 files, mocha/chai. Decent coverage for implemented nodes. PannerNode is most thoroughly tested.

**What works**: The core graph topology, audio param automation, channel mixing, spatial audio pipeline. These are non-trivial and correct.

### What's missing

~12 node types: OscillatorNode, DelayNode, BiquadFilterNode, WaveShaperNode, ConvolverNode, ChannelSplitterNode, ChannelMergerNode, DynamicsCompressorNode, AnalyserNode, StereoPannerNode, ConstantSourceNode, IIRFilterNode. Plus OfflineAudioContext, AudioWorklet, PeriodicWave, MediaStream nodes.

### Branches

- `Oscillator+DelayNodes` — has OscillatorNode, DelayNode, OfflineAudioContext, PeriodicWave implementations. **Not merge-ready**: wrong detune formula (add vs multiply), broken phase accumulation, nested loop bug in DelayNode, discarded buffer in OfflineAudioCompletionEvent, debug console.log left in. Useful as reference only.
- `panner-node`, `node-update-support` — fully merged, delete.
- `dependabot/npm_and_yarn/braces-3.0.3` — stale, delete.

### Landscape

- `node-web-audio-api` (ircam-ismm) — Rust/napi-rs, ~75% WPT passing, actively maintained. The native-addon solution. Cannot run in serverless/edge/browser-like runtimes.
- `web-audio-engine` (mohayonao) — archived, dead.
- `standardized-audio-context` — browser-only ponyfill, wraps native. Not a dependency candidate. Useful as spec reference (TypeScript interfaces).

### Rewrite vs evolve?

**Evolve.** The core architecture (graph topology, audio ports, channel mixing, param automation, DspObject scheduling) is sound and non-trivial. The missing pieces are leaf nodes — each is an isolated DSP kernel plugging into the existing framework. Rewriting would re-solve solved problems.

What needs structural work: EventEmitter → EventTarget, decoding pipeline replacement, modernizing the base classes slightly. But not a rewrite.

### Why this project matters

Pure JS implementation runs everywhere: Node.js, Deno, Bun, Cloudflare Workers, serverless functions, edge runtimes — anywhere native addons can't. The ircam Rust implementation is superior for desktop Node.js, but can't serve these environments. That's the niche.

### audiojs org reuse

| Package | Role | Replaces |
|---|---|---|
| `audio-decode` | WASM-based decoding (12+ formats) | `av`, `aac`, `alac`, `flac`, `mp3` (all ancient 0.x) |
| `audio-buffer` | Spec-compliant AudioBuffer | Internal `AudioBuffer.js` |
| `audio-buffer-utils` | Buffer manipulation utilities | Custom utility code |
| `pcm-convert` | PCM format conversion | Internal encoder in `utils.js` |
| `audio-type` | Format detection from bytes | Manual format routing |
| `decibels` | dB conversions | Inline math in gain/compressor |

### GitHub issues (37 open)

**Structural**: #82 (project direction), #60 (1.0 ideas), #85 (EventTarget), #53 (configurable sampleRate).
**Missing nodes**: #67 (Oscillator), #46 (Analyser), #66 (BiquadFilter), #63 (MediaStreamSource).
**Decode bugs**: #78 (stack overflow), #75 (large file alloc), #73 (swapped callbacks), #76 (m4a co64).
**Correctness**: #80 (output mismatch), #93 (Promise return), #57 (start() silent fail).

Most decode bugs vanish with `audio-decode` migration. Most missing-node issues are addressed by Milestone 1.

---

## Milestone 1 — Complete JS implementation

Goal: spec-compliant pure-JS Web Audio API with clean architecture and thorough tests.

### Phase 1: Foundation cleanup

Modernize the base without breaking what works.

1. **Replace decode pipeline with `audio-decode`**
   - Remove `av`, `aac`, `alac`, `flac`, `mp3` deps
   - Rewrite `decodeAudioData` to use `audio-decode`
   - Fixes #78, #75, #73, #76 in one move

2. **Replace AudioBuffer with `audio-buffer`**
   - Swap internal implementation for `audio-buffer` package
   - Implement `copyFromChannel` / `copyToChannel` (fixes #58, #77)
   - Ensure audioports/channel mixing works with new buffer

3. **EventEmitter → EventTarget**
   - AudioContext, AudioNode, DspObject: replace `events.EventEmitter` with `EventTarget`
   - Implement `addEventListener`, `removeEventListener`, `dispatchEvent`
   - Maintain `on*` handler properties (spec requires both)
   - Fixes #85

4. **AudioContext spec alignment**
   - Configurable `sampleRate` in constructor options (fixes #53)
   - `state` property (`suspended`, `running`, `closed`)
   - `suspend()`, `resume()`, `close()` methods returning Promises
   - `onstatechange` event
   - `baseLatency`, `outputLatency` properties
   - `createPeriodicWave()` method

5. **Replace `pcm-convert` for encoding**
   - Swap internal `BufferEncoder` for `pcm-convert`
   - Remove manual PCM encoding from `utils.js`

6. **Cleanup**
   - Remove `underscore` dev dependency
   - Upgrade `automation-events` to v7
   - Fix error variable name bug in AudioContext tick loop (line 79: `err` should be `e`)
   - Remove stale branches
   - Update package.json: engine requirement, repository field

### Phase 2: Core nodes (pure DSP)

Each node is an isolated DSP kernel. Implement in dependency order.

1. **ConstantSourceNode** — simplest source node, outputs constant value with AudioParam `offset`. Good warm-up.

2. **OscillatorNode** — sine, square, sawtooth, triangle, custom (PeriodicWave). Frequency + detune AudioParams. Start/stop scheduling.
   - PeriodicWave with inverse FFT for custom waveforms
   - Correct detune: `computedFreq = frequency * 2^(detune/1200)`

3. **StereoPannerNode** — simple L/R panning with `pan` AudioParam. Equal-power panning law.

4. **DelayNode** — ring buffer with `delayTime` AudioParam. `maxDelayTime` constructor param.

5. **BiquadFilterNode** — lowpass, highpass, bandpass, lowshelf, highshelf, peaking, notch, allpass. `frequency`, `Q`, `gain`, `detune` AudioParams. `getFrequencyResponse()` method.

6. **WaveShaperNode** — `curve` Float32Array, `oversample` property (none, 2x, 4x).

7. **IIRFilterNode** — feedforward/feedback coefficients, `getFrequencyResponse()`.

8. **ConvolverNode** — time-domain convolution (or overlap-add FFT convolution for performance). `buffer`, `normalize` properties.

9. **DynamicsCompressorNode** — `threshold`, `knee`, `ratio`, `attack`, `release` AudioParams. `reduction` read-only.

10. **ChannelSplitterNode** — splits input channels to separate outputs. No DSP, just routing.

11. **ChannelMergerNode** — merges inputs to single multi-channel output. No DSP, just routing.

12. **AnalyserNode** — FFT analysis. `fftSize`, `frequencyBinCount`, `getFloatFrequencyData()`, `getByteFrequencyData()`, `getFloatTimeDomainData()`, `getByteTimeDomainData()`. Needs FFT implementation (or small dependency).

### Phase 3: Advanced features

1. **OfflineAudioContext** — renders audio graph to buffer synchronously. `startRendering()` returns Promise\<AudioBuffer\>. `oncomplete` event.

2. **AudioWorkletNode / AudioWorkletProcessor** — user-defined DSP in JS. `AudioWorkletGlobalScope`, `registerProcessor()`, message port communication. This is the modern replacement for ScriptProcessorNode.

3. **MediaStream nodes** (if meaningful in Node.js context)
   - `MediaStreamAudioSourceNode` — read from stream
   - `MediaStreamAudioDestinationNode` — write to stream
   - May adapt to Node.js readable/writable streams

4. **AudioScheduledSourceNode** base class — factor out start/stop/onended from BufferSource and Oscillator.

### Phase 4: Spec compliance and testing

1. **Run against W3C Web Platform Tests (WPT)** — the official conformance suite. Set up test harness to execute WPT web-audio tests.

2. **Property descriptors** — ensure all read-only attributes use proper getters, all enums validate, all constructors accept option dictionaries per spec.

3. **Error handling** — spec-defined exceptions: `InvalidStateError`, `NotSupportedError`, `IndexSizeError`, `InvalidAccessError`. `decodeAudioData` error handling per spec.

4. **Edge cases** — zero-length buffers, disconnected nodes, cycles in audio graph (spec allows with DelayNode), channel count changes mid-stream, automation event ordering.

5. **Performance baseline** — benchmark each node type. Identify bottlenecks. Document performance characteristics.

---
