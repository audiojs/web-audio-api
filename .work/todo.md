# web-audio-api — execution plan

Complete canonical pure-JS Web Audio API: elegant, performant, flexible, robust.

## Landscape

| Implementation | Lang | Nodes | Tests | Runtime | Status |
|---|---|---|---|---|---|
| **this** (audiojs/web-audio-api) | JS | ~8/26 | 120 mocha | Node/Deno/Bun/edge/serverless | active |
| node-web-audio-api (ircam) | Rust+JS | ~20/26 | WPT tracked | Node only (native addon) | active |
| web-audio-api-rs (orottier) | Rust | ~18/26 | WPT tracked | Rust/WASM | active |
| web-audio-engine (mohayonao) | JS | ~15/26 | minimal | Node | archived 2019 |
| standardized-audio-context | TS | ~22/26 | browser | browser polyfill | active |

**Our niche**: pure JS = runs everywhere native addons can't. Serverless, edge, Deno, Bun, Workers.

## Affiliate packages (~/projects/*)

| Package | Version | Useful outside WAA? | Decision |
|---|---|---|---|
| `audio-buffer` | 5.0.0 | yes — general AudioBuffer | upstream, depend on it |
| `audio-buffer-utils` | 5.1.2 | yes — buffer ops | upstream, depend on it |
| `audio-buffer-list` | 5.0.0 | yes — buffer sequences | upstream, use if needed |
| `audio-decode` | 3.1.2 | yes — 12+ codec decode | upstream, depend on it |
| `audio-type` | 2.4.0 | yes — format detection | upstream (used by audio-decode) |
| `audio-lena` | 2.3.0 | yes — test fixtures | upstream, devDependency |
| `pcm-convert` | 1.6.5 | yes — PCM conversion | upstream, depend on it |
| `decibels` | 2.0.0 | yes — dB math | upstream, depend on it |
| `automation-events` | 4.x→7.x | yes — param automation | upstream, upgrade to v7 |

All affiliates have standalone value → keep as upstream deps, enhance quality in ~/projects/* directly.

## Engine swappability

DSP kernels isolated from graph/node infrastructure:
- Each node's `_tick()` delegates to a `_dsp()` function (pattern already in AudioParam)
- DSP functions operate on typed arrays only — no node/context refs
- Future WASM: swap `_dsp()` implementations, graph infrastructure unchanged
- Convention: `src/dsp/<NodeName>.js` for JS kernels, replaceable with WASM later

---

## Phase 0: Architecture audit & hardening

Current architecture is **sound in concept** (pull-based graph, audioports, block processing, param automation) but has structural defects that must be fixed before building on top. web-audio-engine (mohayonao) solved several of these — we adopt their lessons.

### Diagnosis

**What's right:**
- Pull-based graph traversal (destination demands upstream) — correct, matches spec
- AudioInput/AudioOutput port abstraction with channel mixing — correct model
- AudioParam with automation-events delegation — clean separation
- DspObject scheduling system — functional, handles timed events
- ChannelMixing with speaker/discrete strategies — spec-compliant coefficients
- Block-oriented processing (128 samples) — matches spec render quantum
- AudioOutput caching (prevents redundant pulls) — essential for fan-out

**What's broken:**

| # | Issue | Severity | Location |
|---|---|---|---|
| 1 | **Buffer alloc in hot path** — every `_tick()` creates `new AudioBuffer()`. GainNode, AudioInput, AudioParam, PannerNode — all allocate per block. At 44.1kHz/128 samples = 344 blocks/sec × N nodes = thousands of allocations/sec. GC pressure kills real-time. | critical | everywhere |
| 2 | **Event name mismatch** — AudioInput listens for `'connected'`/`'disconnected'` but AudioPort emits `'connection'`/`'disconnection'`. Channel recomputation on reconnect is **silently broken**. | critical | audioports.js:57-62 vs :24/:36 |
| 3 | **ChannelMixing instantiated per tick** — `new ChannelMixing()` created for every source on every tick in AudioInput._tick(). Strategy lookup via string concatenation (`'speakerMix' + N + M`) happens every block. | high | audioports.js:103 |
| 4 | **Tick loop trapped in constructor closure** — rendering engine is a closure inside AudioContext constructor. Can't test, extend, override, or share with OfflineAudioContext. | high | AudioContext.js:64-81 |
| 5 | **Error variable bug** — `catch(e)` then references `err` (undefined). Any tick error silently swallowed or throws wrong error. | high | AudioContext.js:77-79 |
| 6 | **`new Buffer()` deprecated** — uses `new Buffer()` instead of `Buffer.alloc()`. Throws in newer Node.js. | high | utils.js:96 |
| 7 | **AudioParam returns AudioBuffer for 1ch** — allocates full AudioBuffer to carry 128 floats of parameter values. Could be bare Float32Array. | medium | AudioParam.js:70-72 |
| 8 | **No BaseAudioContext** — spec requires it. Cannot add OfflineAudioContext without it. All factory methods, destination, listener, sampleRate should live in base. | medium | AudioContext.js |
| 9 | **`super._tick(arguments)` anti-pattern** — every node passes `arguments` to DspObject._tick() which ignores them. Pointless overhead. | low | GainNode, PannerNode, etc. |
| 10 | **Dead code** — `DspObject._loadDSP()` (sync fs.readFileSync WASM), `utils.loadWasm()` (hardcoded path). Non-functional, never called. | low | DspObject.js:14-25, utils.js:126-131 |
| 11 | **Mixed property patterns** — AudioNode uses `#private` fields, PannerNode overrides with `Object.defineProperty`, GainNode uses `readOnlyAttr()`. Three patterns for the same thing. | low | across codebase |
| 12 | **AudioOutput cache creates object per tick** — `this._cachedBlock = { time, buffer }` allocates on every non-cached tick. Should mutate. | low | audioports.js:157-158 |
| 13 | **ScriptProcessorNode concat storm** — uses `.concat()` which allocates new AudioBuffers. For bufferSize=16384, massive intermediate allocs. | medium | ScriptProcessorNode.js:26-33 |
| 14 | **AudioBufferSourceNode._dsp closure** — `start()` replaces `_dsp` with closure capturing cursor state. DSP kernel not separable. | medium | AudioBufferSourceNode.js:44-71 |
| 15 | **No cycle handling** — pull-based recursion will stack overflow on graph cycles. Spec requires DelayNode to break cycles. | medium | audioports.js |

### Architecture principles (established)

1. **Zero alloc in hot path** — pre-allocate all buffers at node construction, reuse per tick
2. **DSP kernel separation** — `_tick()` handles graph plumbing, `_dsp(input, output, params)` does math on typed arrays
3. **Single property pattern** — `#private` fields with getters/setters, no `Object.defineProperty` in constructors
4. **BaseAudioContext** — shared base for AudioContext + OfflineAudioContext, tick loop as method not closure
5. **Internal events as direct calls** — replace EventEmitter signaling between ports with direct method calls where possible
6. **ChannelMixing cached** — create once per connection topology change, reuse across ticks

### 0.1 Fix critical bugs ✅
- [x] Fix event name mismatch: `'connected'`→`'connection'`, `'disconnected'`→`'disconnection'`
- [x] Fix error variable: `err`→`e`
- [x] Fix `new Buffer()`→`Buffer.alloc()`
- [x] Remove dead code: `DspObject._loadDSP()`, `utils.loadWasm()`, `fs` import
- [x] Fix `super._tick(arguments)` → `super._tick()` everywhere

### 0.2 Buffer pool — zero alloc hot path ✅
- [x] AudioParam._tick(): returns pre-allocated Float32Array directly
- [x] AudioInput: pre-allocate mix buffer, resize only on channel count change
- [x] AudioOutput: mutate `_cachedBlock` in place
- [x] GainNode: pre-allocate output buffer, reallocate only on channel count change
- [x] PannerNode: pre-allocate stereo output buffer in constructor

### 0.3 ChannelMixing — cache per topology ✅
- [x] Cache ChannelMixing instances in Map keyed by `inCh:outCh:interpretation`
- [x] Invalidate cache on connection/disconnection events

### 0.4 DSP kernel separation ✅
- [x] GainNode: `static _dsp(inBuf, outBuf, gain, channels, blockSize)` — pure typed array math
- [x] AudioBufferSourceNode: cursor/playback state as instance fields, `_dspPlayback()` method
- [x] AudioParam: `_dsp(outArray)` pattern preserved
- [x] Convention established: DSP functions operate on typed arrays only

### 0.5 Tick loop extraction ✅
- [x] `_render()` method: pull destination, advance frame, encode output
- [x] `_renderLoop()` method: drives real-time output to outStream
- [x] `currentTime` as computed getter: `#frame / #sampleRate`
- [x] `sampleRate` as read-only `#private` getter

### 0.6 Unify property patterns ✅
- [x] AudioParam: `#defaultValue`, `#instrinsicValue` with getters/setters
- [x] GainNode: `#gain` with getter
- [x] AudioBufferSourceNode: `#playbackRate` with getter
- [x] AudioDestinationNode: `#maxChannelCount` with getter
- [x] ScriptProcessorNode: `#bufferSize` with getter
- [x] audioports: `sources`/`sinks` as class getters
- [x] Removed `readOnlyAttr()` utility — all native class syntax
- [x] Removed unused imports (`utils` from AudioNode, audioports)

---

## Phase 1: Foundation cleanup

### 1.1 Replace decode pipeline with `audio-decode` ✅
- [x] Removed deps: `av`, `aac`, `alac`, `flac`, `mp3` (5 deps → 0)
- [x] Added dep: `audio-decode` (WASM-based, 12+ formats)
- [x] Rewrote `decodeAudioData` → async, uses `audio-decode`
- [x] AudioContext.decodeAudioData returns Promise always, callback compat preserved
- [x] Tests: decode wav (mono/stereo), mp3, error handling
- [x] Fixes #78, #75, #73, #76

### 1.2 Replace AudioBuffer with `audio-buffer` ✅
- [x] Enhanced `audio-buffer` v6 upstream: #private fields, positional constructor, fromArray, filledWithVal, slice, concat, set, copyFrom/ToChannel, validation
- [x] Migrated audio-buffer tests to tst (37 tests passing)
- [x] Removed `src/AudioBuffer.js`, all imports → `audio-buffer` package
- [x] Fixed 0-length buffer edge cases in ScriptProcessorNode and AudioBufferSourceNode
- [x] `_data` → `_channels` internal API aligned
- [x] Fixes #58, #77

### 1.3 Replace PCM encoding with `pcm-convert`
- [ ] Add dep: `pcm-convert`
- [ ] Remove `BufferEncoder` from utils.js
- [ ] Update AudioContext to use `pcm-convert` for output encoding
- [ ] Test: output stream produces correct PCM bytes

### 1.4 EventEmitter → EventTarget
- [ ] DspObject: extend EventTarget instead of EventEmitter
- [ ] AudioContext: extend EventTarget instead of EventEmitter
- [ ] Implement addEventListener, removeEventListener, dispatchEvent
- [ ] Maintain `on*` handler properties (spec requires both patterns)
- [ ] Update all internal `.emit()` → `.dispatchEvent()`
- [ ] Update all internal `.on()` → `.addEventListener()`
- [ ] Update audioports event handling
- [ ] Test: event dispatch, on* handlers, multiple listeners
- [ ] Fixes #85

### 1.5 AudioContext spec alignment
- [x] Constructor options: `{ sampleRate }` (fixes #53) — done in Phase 0.5
- [x] Fix error variable bug `err` → `e` — done in Phase 0.1
- [ ] `state` property: 'suspended' | 'running' | 'closed'
- [ ] `suspend()` → Promise, pause tick loop
- [ ] `resume()` → Promise, resume tick loop
- [ ] `close()` → Promise, stop and release
- [ ] `onstatechange` event on state transitions
- [ ] `baseLatency` getter (computed from BLOCK_SIZE / sampleRate)
- [ ] `outputLatency` getter
- [ ] `createPeriodicWave(real, imag, constraints?)` method
- [ ] Test: state machine, suspend/resume/close, factory methods

### 1.6 Cleanup & upgrades
- [x] Removed `underscore` devDependency — done in Phase 0
- [x] Migrated test framework: mocha/chai → tst — done in Phase 0
- [ ] Upgrade `automation-events` 4.x → 7.x, update AudioParam imports/usage
- [ ] Update engine requirement: `node >= 18`
- [ ] Add dep: `decibels` (for gain/compressor dB conversions)
- [ ] Delete stale branches: `panner-node`, `node-update-support`, `dependabot/*`
- [ ] Test: full suite passes after all phase 1 changes

---

## Phase 2: Core nodes (DSP kernels)

Each node: implement, test, export from index.js, add factory to AudioContext.
DSP in separate `_dsp()` for future WASM swap.

### 2.0 AudioScheduledSourceNode base class
- [ ] Extract start/stop/onended from AudioBufferSourceNode into base class
- [ ] Properties: `onended`
- [ ] Methods: `start(when)`, `stop(when)`
- [ ] AudioBufferSourceNode extends it
- [ ] OscillatorNode will extend it
- [ ] ConstantSourceNode will extend it

### 2.1 ConstantSourceNode
- [ ] 0 inputs, 1 output
- [ ] `offset` AudioParam (a-rate, default 1)
- [ ] Extends AudioScheduledSourceNode
- [ ] DSP: output = offset value per sample
- [ ] Test: constant output, offset automation, start/stop

### 2.2 OscillatorNode + PeriodicWave
- [ ] 0 inputs, 1 output
- [ ] `frequency` AudioParam (a-rate, default 440)
- [ ] `detune` AudioParam (a-rate, default 0)
- [ ] `type`: sine, square, sawtooth, triangle, custom
- [ ] Computed frequency: `frequency * 2^(detune/1200)`
- [ ] Phase accumulator with anti-aliasing
- [ ] `setPeriodicWave(wave)` for custom waveforms
- [ ] Extends AudioScheduledSourceNode
- [ ] PeriodicWave: constructor `(real, imag, { disableNormalization })`
- [ ] PeriodicWave: inverse FFT for time-domain waveform
- [ ] PeriodicWave: built-in waves as PeriodicWave internally
- [ ] Test: each waveform type, frequency/detune automation, start/stop/onended, custom wave

### 2.3 StereoPannerNode
- [ ] 1 input, 1 output
- [ ] `pan` AudioParam (a-rate, default 0, range -1 to 1)
- [ ] Equal-power panning law
- [ ] Mono input: pan across stereo field
- [ ] Stereo input: balance adjustment
- [ ] Test: pan left/center/right, mono→stereo, stereo balance

### 2.4 DelayNode
- [ ] 1 input, 1 output
- [ ] `delayTime` AudioParam (a-rate, default 0)
- [ ] `maxDelayTime` constructor param (default 1.0)
- [ ] Ring buffer implementation
- [ ] Must support cycles in audio graph (spec requirement)
- [ ] Test: delay accuracy, modulated delay, feedback loop

### 2.5 BiquadFilterNode
- [ ] 1 input, 1 output
- [ ] `frequency` AudioParam (a-rate, default 350)
- [ ] `detune` AudioParam (a-rate, default 0)
- [ ] `Q` AudioParam (a-rate, default 1)
- [ ] `gain` AudioParam (a-rate, default 0)
- [ ] `type`: lowpass, highpass, bandpass, lowshelf, highshelf, peaking, notch, allpass
- [ ] `getFrequencyResponse(frequencyHz, magResponse, phaseResponse)`
- [ ] Biquad coefficient calculation per filter type (Audio EQ Cookbook)
- [ ] Test: each filter type, frequency response, coefficient accuracy

### 2.6 WaveShaperNode
- [ ] 1 input, 1 output
- [ ] `curve` Float32Array (null = passthrough)
- [ ] `oversample`: 'none' | '2x' | '4x'
- [ ] Linear interpolation for curve lookup
- [ ] Oversampling: upsample → shape → downsample (anti-aliasing filter)
- [ ] Test: distortion curve, passthrough, oversampling quality

### 2.7 IIRFilterNode
- [ ] 1 input, 1 output
- [ ] Constructor: `(feedforward, feedback)` coefficient arrays
- [ ] `getFrequencyResponse(frequencyHz, magResponse, phaseResponse)`
- [ ] Direct Form II Transposed implementation
- [ ] Test: known filter responses, stability check

### 2.8 ConvolverNode
- [ ] 1 input, 1 output
- [ ] `buffer` AudioBuffer (impulse response)
- [ ] `normalize` boolean (default true)
- [ ] Time-domain convolution (simple first, correct)
- [ ] Optimize: overlap-add FFT convolution for long IRs
- [ ] Test: impulse response, normalization, stereo convolution

### 2.9 DynamicsCompressorNode
- [ ] 1 input, 1 output
- [ ] `threshold` AudioParam (k-rate, default -24)
- [ ] `knee` AudioParam (k-rate, default 30)
- [ ] `ratio` AudioParam (k-rate, default 12)
- [ ] `attack` AudioParam (k-rate, default 0.003)
- [ ] `release` AudioParam (k-rate, default 0.25)
- [ ] `reduction` read-only (current gain reduction in dB)
- [ ] Use `decibels` package for dB conversions
- [ ] Test: compression ratio, attack/release timing, knee curve

### 2.10 ChannelSplitterNode
- [ ] 1 input, N outputs (default 6)
- [ ] No DSP — routing only
- [ ] Output[i] gets channel[i] from input
- [ ] Test: split stereo, split surround

### 2.11 ChannelMergerNode
- [ ] N inputs (default 6), 1 output
- [ ] No DSP — routing only
- [ ] Output channel[i] = input[i] channel 0
- [ ] Test: merge mono sources, channel ordering

### 2.12 AnalyserNode
- [ ] 1 input, 1 output (passthrough)
- [ ] `fftSize` (power of 2, 32–32768, default 2048)
- [ ] `frequencyBinCount` (fftSize / 2, read-only)
- [ ] `minDecibels`, `maxDecibels`, `smoothingTimeConstant`
- [ ] `getFloatFrequencyData(array)`
- [ ] `getByteFrequencyData(array)`
- [ ] `getFloatTimeDomainData(array)`
- [ ] `getByteTimeDomainData(array)`
- [ ] FFT: inline radix-2 Cooley-Tukey (small, no dep)
- [ ] Blackman window for spectral analysis
- [ ] Test: FFT of known signal (sine → single bin), time domain passthrough

---

## Phase 3: Advanced features

### 3.1 BaseAudioContext refactor
- [ ] Extract shared interface from AudioContext
- [ ] Factory methods, destination, listener, currentTime, sampleRate
- [ ] AudioContext extends BaseAudioContext (real-time)
- [ ] OfflineAudioContext extends BaseAudioContext (offline)

### 3.2 OfflineAudioContext
- [ ] Constructor: `(numberOfChannels, length, sampleRate)`
- [ ] `startRendering()` → Promise<AudioBuffer>
- [ ] `oncomplete` event (OfflineAudioCompletionEvent)
- [ ] `suspend(time)`, `resume()` for offline control
- [ ] No outStream — renders to internal buffer
- [ ] Test: render sine wave, verify output buffer, suspend/resume

### 3.3 AudioWorkletNode / AudioWorkletProcessor
- [ ] `AudioWorkletGlobalScope` with `registerProcessor()`
- [ ] `AudioWorkletNode` — custom node from registered processor
- [ ] `AudioWorkletProcessor` — base class users extend
- [ ] `process(inputs, outputs, parameters)` callback
- [ ] MessagePort communication between node and processor
- [ ] `parameterDescriptors` static getter for custom AudioParams
- [ ] Test: passthrough processor, gain processor, message passing

### 3.4 MediaStream nodes (Node.js adaptation)
- [ ] `MediaStreamAudioSourceNode` — read from Node.js Readable stream
- [ ] `MediaStreamAudioDestinationNode` — write to Node.js Writable stream
- [ ] Adapt MediaStream concept to Node streams API
- [ ] Test: pipe audio through Node streams

---

## Phase 4: Spec compliance & quality

### 4.1 WPT test harness
- [ ] Set up W3C Web Platform Tests runner for web-audio tests
- [ ] Identify passing/failing tests
- [ ] Track WPT pass rate as primary completeness metric
- [ ] Compare pass rate against node-web-audio-api (ircam)

### 4.2 Property descriptors & validation
- [ ] All read-only attributes use proper getters
- [ ] All enums validate values (throw on invalid)
- [ ] All constructors accept option dictionaries per spec
- [ ] AudioNode.connect() validates params, throws spec errors

### 4.3 Error handling
- [ ] `InvalidStateError` — wrong state transitions
- [ ] `NotSupportedError` — unsupported configs
- [ ] `IndexSizeError` — out-of-range indices
- [ ] `InvalidAccessError` — invalid access patterns
- [ ] `EncodingError` for decodeAudioData failures
- [ ] Proper DOMException subclasses

### 4.4 Edge cases
- [ ] Zero-length buffers
- [ ] Disconnected nodes (no processing)
- [ ] Cycles in audio graph (spec: allowed with DelayNode)
- [ ] Channel count changes mid-stream
- [ ] Automation event ordering edge cases
- [ ] Multiple start() calls (should throw)
- [ ] Calling methods on closed context

### 4.5 Benchmarking
- [ ] Benchmark harness: ops/sec per node type
- [ ] Compare against web-audio-engine (archived JS baseline)
- [ ] Compare against node-web-audio-api (ircam — native baseline)
- [ ] Profile: identify hot paths for future WASM optimization
- [ ] Memory benchmark: buffer allocation, GC pressure
- [ ] Document performance characteristics per node
- [ ] Use spotify/web-audio-bench if applicable

### 4.6 Packaging & CI
- [ ] Full exports from index.js (all nodes, contexts, types)
- [ ] TypeScript declarations (.d.ts) — reference standardized-audio-context types
- [ ] README: usage, API, runtime support, benchmarks
- [ ] CI: test on Node 18+, Deno, Bun
