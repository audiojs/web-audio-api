## Essence

Web Audio API in pure JavaScript.

Same API, same behavior, proven by the same test suite (99% WPT). Runs everywhere JavaScript does — Node.js, Deno, Bun, serverless, edge. The only spec-compliant implementation with zero native dependencies.

## What suffering ends

A developer needs audio processing outside a browser. They know the Web Audio API. They try Rust-based alternatives — native addon, won't run in their environment. They find archived JS implementations from 2019. They're stuck writing raw DSP by hand.

This project: `import { AudioContext } from 'web-audio-api'` — their existing knowledge works.

## Who it's for

- Developers who need audio processing outside browsers
- Testing Web Audio code in CI without headless Chrome
- Audio tools and CLIs with a familiar API
- AI/ML pipelines preprocessing audio in serverless functions
- Isomorphic audio: share code between client and server
- Audio as function: OfflineAudioContext turns graphs into pure functions (graph in → buffer out)

## Who it's NOT for

- Browser users — use the native API
- Node.js users needing maximum throughput without portability — use `node-web-audio-api` (Rust)
- Rust ecosystem — use `web-audio-api-rs`

## One job

Fidelity. Be the Web Audio API. Not "inspired by," not "compatible with." The same API, the same behavior, proven by the same test suite. The spec is the soul — the moment it diverges to be "helpful," it betrays its purpose.

## What it must NOT become
A "better" audio API. A framework. An opinionated toolkit. The moment it diverges from the spec to be "helpful," it betrays its purpose. The spec is the soul.

## Moat

1. **Pure JS** — the only spec-compliant implementation with zero native dependencies
2. **99% WPT** — not an approximation, proven conformance
3. **`web-audio-api` on npm** — canonical name
4. **4 production dependencies** — minimal surface area
5. **audiojs ecosystem** — audio-buffer, audio-decode feed into it

## Honest limitations

- Pure JS is slower than Rust/native — performance ceiling for complex real-time graphs
- `outStream` is non-standard — the one API surface that isn't part of the spec
- ~1% WPT gap is fundamental: some tests require browser DOM (MediaElement, hardware output)
- AudioWorklet runs synchronously (browsers use a separate thread)
- WPT evolves — 99% requires ongoing maintenance


## Hidden value

- **Educational**: Source code is a readable spec implementation — learn DSP by reading JS, not browser C++
- **Test oracle**: Other implementations can verify output against this reference
- **Extractable DSP**: Each node's `_dsp()` is a standalone algorithm (biquad, FFT, convolution, compression)
- **Isomorphic**: Write audio processing once, run on client and server
- **Serverless audio**: OfflineAudioContext = pure function, perfect for cloud functions

## Distribution

- Package name `web-audio-api` on npm = anyone searching finds it
- API surface already known by every web audio developer = zero learning curve
- The "you gotta see this" moment: existing browser audio code runs in Node.js unchanged
- Every WPT test passed is permanent credibility. The spec is stable — this work doesn't depreciate.

## Use cases

1. **Server-side rendering** — generate audio on servers (podcasts, music, sound effects)
2. **Audio preprocessing for ML** — extract features (FFT, biquad filter chains) in serverless
3. **CI testing** — test Web Audio code without a browser
4. **Edge audio** — process audio at CDN edge (Cloudflare Workers, Deno Deploy)
5. **CLI tools** — audio manipulation with familiar API
6. **Isomorphic audio** — share graph definitions between browser and server

## Landscape

| Implementation | Lang | Nodes | Tests | Runtime | Status |
|---|---|---|---|---|---|
| **this** (audiojs/web-audio-api) | JS | 21/26 | 202 tst | Node/Deno/Bun/edge/serverless | active |
| node-web-audio-api (ircam) | Rust+JS | ~20/26 | WPT tracked | Node only (native addon) | active |
| web-audio-api-rs (orottier) | Rust | ~18/26 | WPT tracked | Rust/WASM | active |
| web-audio-engine (mohayonao) | JS | ~15/26 | minimal | Node | archived 2019 |
| standardized-audio-context | TS | ~22/26 | browser | browser polyfill | active |
