# web-audio-api — agent instructions

## What this is

Pure-JS W3C Web Audio API. 100% WPT (4300/4300). The spec is the soul — never diverge.

## Commands

- `npm test` — 263 unit tests, ~1s (use for quick validation)
- `npm run wpt` — 4300 W3C Web Platform Tests, ~22s (run after DSP changes)
- `npm run bench` — performance benchmarks, ~2s

## Sacred invariant

**100% WPT must be maintained.** Any code change that breaks WPT is wrong. Run `npm run wpt` before reporting DSP work as complete.

## Architecture

Pull-based audio graph. `AudioDestinationNode` pulls upstream via `_tick()`, 128-sample render quanta per spec.

```
EventTarget ← Emitter ← DspObject ← AudioNode ← concrete nodes
                                    ← AudioParam
EventTarget ← Emitter ← AudioPort ← AudioInput / AudioOutput
```

### Rendering contract

Every node's `_tick()` must call `super._tick()` first (processes scheduled events), then pull inputs and produce output. Returns an `AudioBuffer` of `BLOCK_SIZE` (128) samples.

### Float precision rules

- **AudioParam automation**: computed in Float64Array to avoid intermediate rounding
- **AudioParam.value getter**: returns `Math.fround(value)` (Float32 per spec)
- **ConstantSourceNode**: outputs Float64Array (not Float32) to avoid double-rounding when modulating other AudioParams
- **BiquadFilterNode/IIRFilterNode state**: Float64 to preserve precision across iterations
- **ConvolverNode**: FFT multiply-accumulate uses `Math.fround()` per product to match hardware rounding

### Cycle detection

Consolidated in `context._cycle` object. Logic spans three files:
- `audioports.js` (AudioOutput._tick) — detects re-entry, flags cycles
- `DelayNode.js` — manages `_inCycle`, defers ring buffer writes in cycles
- `BaseAudioContext.js` — owns `_cycle` state, executes deferred writes after graph pull

### Node implementation pattern

Every node follows the same structure:
1. Constructor: validate options → `super(context, inputs, outputs, ...)` → create AudioParams → `_applyOpts(options)`
2. `_tick()`: call `super._tick()` → pull inputs → process → return `_outBuf`
3. Channel reallocation: `if (ch !== this._outCh) { this._outBuf = new AudioBuffer(...); this._outCh = ch }`

### Tail nodes

AnalyserNode, MediaStreamAudioDestinationNode, and AudioWorkletNode register in `context._tailNodes` so they're processed even when not connected to destination.

## Key files

- `src/BaseAudioContext.js` — graph rendering loop, factory methods
- `src/AudioParam.js` — automation timeline, k-rate/a-rate processing
- `src/audioports.js` — AudioInput/AudioOutput, channel mixing, cycle detection
- `src/DelayNode.js` — ring buffer, cycle-aware deferred write
- `src/AudioWorklet.js` — processor registry, message ports, `with`-based scope

## Dependencies (owned)

- `audio-buffer` — AudioBuffer implementation (owned by same author)
- `audio-decode` — multi-format decoding (owned)
- `automation-events` — AudioParam timeline (third-party)
- `fourier-transform` — FFT (owned)

`audio-buffer._channels` is accessed directly in ConstantSourceNode and AudioBufferSourceNode — no public API exists for channel replacement.
