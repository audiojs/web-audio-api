## Essence

Portable Web Audio API.

The Web Audio API is a powerful W3C standard — but it only exists in browsers. This project closes the platform gap: same API, same behavior, proven by the same test suite (99% WPT). Runs in Node.js, Deno, Bun, serverless, edge — no native compilation required.

## What suffering ends

A developer needs audio processing outside a browser. They know the Web Audio API — it's what browsers use, what MDN documents, what tutorials teach. They try Rust-based alternatives — needs native compilation, won't run in their environment. They find archived JS implementations from 2019. They're stuck writing raw DSP by hand.

This project: `import { AudioContext } from 'web-audio-api'` — their existing knowledge works, anywhere.

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

1. **Portable** — the only spec-compliant implementation requiring no native compilation (holds for JS today, WASM tomorrow)
2. **100% WPT** — not an approximation, proven conformance
4. **Minimal surface** — 4 production dependencies
5. **audiojs ecosystem** — audio-buffer, audio-decode feed into it

## Honest limitations

- Performance ceiling for complex real-time graphs (WASM kernels planned to close this gap)
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

| Implementation | Portable | Conformance | Runtimes | Status |
|---|---|---|---|---|
| **this** (audiojs/web-audio-api) | Yes | 99% WPT | Node/Deno/Bun/edge/serverless | active |
| node-web-audio-api (ircam) | No (native addon) | ~75% WPT | Node only | active |
| web-audio-api-rs (orottier) | No (Rust binary) | WPT tracked | Rust/WASM | active |
| web-audio-engine (mohayonao) | Yes | minimal | Node | archived 2019 |
| standardized-audio-context | Browser only | browser-native | browser polyfill | active |

## Ideas

* https://www.facebook.com/share/r/18HdZba8T3/ - formulas sounder?
