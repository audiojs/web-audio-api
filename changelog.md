# Changelog

#### 1.0.0

Pure-JS Web Audio API. 100% W3C Web Platform Tests conformance.

**Spec compliance**
- 100% WPT pass rate (4300 tests)
- All 26 audio node types implemented
- Sample-accurate scheduling with sub-sample interpolation
- AudioWorklet with URL module loading and MessagePort
- Full AudioParam automation (setValueAtTime, ramps, curves, cancelAndHold)
- Correct channel mixing (speakers/discrete) per spec
- OfflineAudioContext with suspend/resume

**Runs everywhere**
- Node.js 18+, Deno, Bun
- Serverless, edge, Workers
- Browser polyfill: `import 'web-audio-api/polyfill'`
- Auto-detects `speaker` package for real-time output, falls back to stdout

**Dependencies**
- `audio-buffer` — AudioBuffer
- `audio-decode` — 12+ audio format decoding
- `automation-events` — AudioParam automation timeline
- `fourier-transform` — FFT (real + complex)

**Breaking changes from 0.x**
- ESM only (no CommonJS)
- Requires Node.js 18+
- `AudioContext` starts suspended (call `resume()`)
- `outStream` auto-detects — no longer required to set manually
- Error types are spec-correct DOMException (not plain Error)

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
