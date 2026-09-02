# Website and user research

This is the working product brief for the `web-audio-api` website. It records who the project is for, what evidence supports that view, what the website must prove, and which claims need more evidence.

Last reviewed: 2026-08-29

## Essence

Web Audio graphs should not become browser-only assets. `web-audio-api` lets JavaScript developers run the same API shape in Node, CI, servers, Deno, and Bun, with explicit adapters at the audio I/O boundary.

The site has one primary job: get a developer from recognition to a runnable graph without making them read a marketing argument.

## Users

### 1. Developers moving an existing browser graph or library into Node

They already understand Web Audio. They do not need an API tutorial. Their trigger is an existing graph, synth, visualizer, game-audio system, or browser library that now needs to render or run outside a tab.

Evidence:

- Issue [#88](https://github.com/audiojs/web-audio-api/issues/88) asks about Tone.js and offline audio.
- Issue [#80](https://github.com/audiojs/web-audio-api/issues/80) asks for the same data as the browser API.
- Issue [#72](https://github.com/audiojs/web-audio-api/issues/72) asks for a polyfill entry.
- The repository ships a polyfill and tests Tone.js integration.

What they need first:

- One recognizable Web Audio snippet.
- A precise import boundary.
- Proof that constructors, automation, and graph behavior follow the specification.
- An honest list of browser or DOM assumptions that still need adapters.

### 2. Developers testing audio code in CI

Their trigger is nondeterministic browser automation, a test runner with no audio device, or audio code that currently has no assertions.

Evidence:

- `OfflineAudioContext` is a complete implementation path in the repository.
- The project itself runs the W3C Web Platform Tests headlessly.
- Existing examples assert samples, RMS, spectra, duration, and channel layout.

What they need first:

- No speaker requirement.
- A small offline render.
- Examples of useful assertions, not only “the promise resolved.”
- Deterministic graph construction where random input is seeded.

### 3. Developers generating, decoding, analyzing, or processing audio in scripts and services

Their trigger is a build step, bot, API endpoint, dataset, batch job, media pipeline, or command-line tool that needs audio without a browser process.

Evidence:

- Issue [#90](https://github.com/audiojs/web-audio-api/issues/90) asks about an audio server.
- Issue [#70](https://github.com/audiojs/web-audio-api/issues/70) asks about analyzing audio from a URL.
- Issue [#15](https://github.com/audiojs/web-audio-api/issues/15) asks for more decoded formats.
- Repository examples cover file processing, PCM piping, FFT analysis, offline rendering, synthesis, and deterministic generation.

What they need first:

- Broad decoding without installing FFmpeg.
- Writable-stream output.
- Offline rendering with no device.
- Clear memory and latency boundaries for large files and long-running services.

### 4. Developers connecting microphones and speakers to a Web Audio graph in Node

Their trigger is a recorder, tuner, meter, telephony path, acoustic test, or realtime monitor.

Evidence:

- Issues [#35](https://github.com/audiojs/web-audio-api/issues/35), [#49](https://github.com/audiojs/web-audio-api/issues/49), [#63](https://github.com/audiojs/web-audio-api/issues/63), and [#79](https://github.com/audiojs/web-audio-api/issues/79) concern capture, microphone levels, MediaStreams, and stream modification.
- `@audio/speaker` is the default output adapter.
- `@audio/mic` is an optional input adapter used by the microphone examples.

What they need first:

- Which package owns the device boundary.
- Whether monitoring opens a real device.
- Channel count, sample rate, and PCM format controls.
- A warning that low-latency production audio is not the project’s strongest present claim.

### 5. Maintainers choosing between Web Audio implementations

Their trigger is a stack decision. They compare compliance, performance, package size, native requirements, deployment targets, codec support, and maintenance state.

What they need first:

- A factual comparison table with dates and sources.
- A distinction between pure JavaScript portability and native low-latency performance.
- A distinction between a Node implementation and a browser compatibility wrapper.
- Reproducible benchmarks instead of adjectives.

## Jobs and trigger moments

| Trigger moment | Job | First useful example |
| --- | --- | --- |
| “This graph works in Chrome; it must render in a Node job.” | Port a graph | Reference tone, offline render |
| “Our audio tests require a browser and speakers.” | Test in CI | Linked parameters, offline render, FFT |
| “Decode this customer upload and process it.” | Decode and transform media | Process file |
| “Generate an asset during a build.” | Compile audio | Tone, noise, synthesis, generative examples |
| “Pipe graph output into FFmpeg or another process.” | Stream PCM | Pipe stdout |
| “Run Tone.js on the server.” | Reuse a browser library | Tone.js polyfill FAQ and guide |
| “Measure or record a microphone in Node.” | Connect live input | Microphone, tuner, recorder |
| “Choose a Web Audio engine for a service.” | Evaluate alternatives | Comparison FAQ, benchmarks, compatibility notes |

## Positioning

### Competitive alternatives

The real alternatives depend on the job:

1. Keep the graph in a headless browser.
2. Rewrite the graph around a Node-specific DSP library.
3. Use `node-web-audio-api` and accept a native binary.
4. Use `web-audio-engine` and accept a smaller, older API surface.
5. For browser consistency only, use `standardized-audio-context`.
6. Do nothing and leave audio code untested.

### Unique attributes with evidence

- Pure JavaScript implementation with no native engine dependency.
- 4,317 passing Web Platform Tests in the repository runner.
- Node, Deno, and Bun test jobs.
- Browser-shaped constructors, graph connections, 128-frame render quanta, and automation.
- Realtime speaker output, stream sinks, microphone adapters, and offline rendering.
- Direct `@audio/decode` integration for broad JS/WASM media decoding.
- A graph corpus designed to run behind both a browser adapter and a CLI adapter.

### Value themes

- **Keep the graph.** Change the runtime boundary rather than rewriting the audio system.
- **Test the signal.** Render deterministic buffers and make assertions without a device.
- **Deploy without a native audio engine.** Pure JavaScript is easier to inspect and deploy across JavaScript runtimes.
- **Decode more inputs.** The Node implementation can support a broader deterministic codec set than a single browser installation.

### Onliness statement

For JavaScript developers who already have Web Audio code, `web-audio-api` is the pure-JavaScript implementation that runs the browser API shape in headless runtimes while keeping device, file, and stream adapters explicit.

This statement is deliberately narrower than “Web Audio everywhere.” The package is not the best answer for every low-latency native application.

## Evidence

### Strong evidence

- Full local WPT result: 4,317 passed, 0 failed.
- Unit and integration coverage includes graph rendering, automation, cycles, worklets, media streams, decoding, and generated site structure.
- Every example has a Node CLI and a browser-safe graph module.
- The npm downloads API reported 243,377 downloads from 2025-08-30 through 2026-08-29 and 26,554 downloads from 2026-07-31 through 2026-08-29.

Download counts are distribution evidence, not proof of active users. They include repeat installs, automation, mirrors, and transitive usage.

### Demand signals from issues

Recurring issue clusters:

- Server and headless use: #90, #88, #70.
- Microphone and MediaStream use: #79, #63, #49, #35.
- Device and latency friction: #81, #69, #56, #47, #36.
- Decoding breadth and failures: #87, #78, #76, #75, #73, #15, #14.
- Spec compatibility and missing nodes: #82, #80, #77, #67, #66, #58, #46, #26, #24.

The issue history supports a site organized around runnable jobs and objections. It does not support a generic Web Audio tutorial.

## Decoding opportunity

`audio-decode` is now an unscoped alias of `@audio/decode`. Depending directly on `@audio/decode` makes the capability explicit and follows the maintained package.

`@audio/decode` is a JS/WASM decoder layer with format detection and lazy codec loading. Its documented families include:

- MP3, WAV, Ogg Vorbis, Opus, FLAC, AAC, ALAC, QOA, AIFF, and CAF.
- MP4, MOV, M4V, 3GP, WebM, MKV, and AVI containers with supported audio tracks.
- AC-3, DTS, AMR, WMA, WavPack, TTA, Musepack, tracker modules, and DSD.

Why this matters:

- No FFmpeg process or native binding is required.
- Codec code is loaded when that format is decoded.
- Browser and Node decoding can use the same decoder packages.
- Video containers can yield their audio track directly.

Boundary:

- The umbrella installs codec packages even though execution is lazy.
- Individual codecs have different licences, including MIT, GPL, LGPL, BSD, and Apache variants. Applications that redistribute codec bundles must check the decoder project’s licence table.
- Whole-file `decodeAudioData()` still materializes decoded samples in memory. Streaming decode is a separate `@audio/decode` API and is not automatically a streaming Web Audio source.

## Alternatives

Snapshot sources were reviewed on 2026-08-29. Package sizes are npm unpacked package sizes, not complete installed dependency trees.

| Alternative | Engine | Runtime and requirements | Decode support | Size snapshot | Best fit |
| --- | --- | --- | --- | ---: | --- |
| `web-audio-api` | Pure JavaScript | Node 18+, Deno, Bun; no native engine | `@audio/decode`, 20+ format families | 208 KB core package | Portable graphs, CI, scripts, servers |
| `node-web-audio-api` | Rust `web-audio-api-rs` via Node-API | Node 22+; prebuilt binaries for listed Windows, macOS, and Linux targets; JACK or PipeWire-JACK considerations on Linux | Symphonia common audio and container formats | 42.2 MB | Native performance and low-latency work |
| `standardized-audio-context` | Ponyfill over browser-native Web Audio | Supported browsers | Whatever the browser decodes | 3.0 MB | Normalizing browser differences |
| `web-audio-engine` | Pure JavaScript | Node and a browser build; last npm release 0.13.4 | WAV by default, custom decoder hook | Registry did not publish an unpacked-size value | Legacy PCM streaming and rendering |
| `web-audio-api-rs` | Pure Rust | Rust application with platform audio backends | Symphonia | Rust crate, not an npm package | Native apps and Rust services |

Do not flatten this into “ours wins every column.” The native Rust implementation is the stronger choice when hard realtime performance dominates. The browser ponyfill solves a different problem. The ownable position is portable JavaScript plus conformance plus broad decoding.

## FAQ objection ledger

The homepage FAQ should answer these first, in this order:

1. Is it fast enough for realtime audio?
2. How do speakers and mics work in Node?
3. Which formats can `decodeAudioData()` read?
4. Does it run Tone.js and browser-oriented libraries?
5. How do I test audio in CI?
6. Can it run without speakers?
7. Does it support AudioWorklets?
8. What differs from native browser Web Audio?
9. Where does it run?
10. How does it compare with alternatives?

Implementation trivia belongs in source documentation, not the homepage FAQ.

## Example architecture

The canonical example shape is:

```text
examples/graphs/tone.js   atomic runtime-neutral graph: build(ctx, options)
examples/tone.js          Node CLI adapter: parse args, open output, call build
examples/browser.js       browser adapter: native context, controls, visualization
examples/catalog.js       names, descriptions, jobs, commands
examples/options.js       shared CLI and browser option metadata
```

Rules:

- One atomic graph module per example. No monolithic private “portable” file and no helper imports between example sources.
- Graph modules accept a context and options. They do not own process arguments, the DOM, device permission UI, or terminal controls.
- CLI files are thin adapters and remain directly runnable.
- The browser adapter imports the same graph module and supplies native Web Audio constructors where needed.
- Microphones, files, recorders, and writable streams remain explicit runtime boundaries.
- Every example keeps an indexable canonical page. Homepage links open the modal on an ordinary click; modified clicks, no-JavaScript visits, and direct URLs open the full page.

## Website structure

Current visible structure:

1. Product title and one runnable code sample.
2. Install command.
3. Two-column example catalogue grouped by kind.
4. Modal containing the browser preview and atomic graph source, with the CLI invocation kept in the source header comment; every link also has a canonical detail page.
5. Compact objection-led FAQ, with the comparison table inside it.
6. One-line licence footer.

The website intentionally hides separate use-case, CI, Tone.js, compatibility, proof, and limitations sections. Their useful facts live in the FAQ. The catalogue is the product demonstration.

## Boundaries

Never imply:

- Native-grade low latency for every production graph.
- AudioWorklet thread isolation that does not exist yet.
- That browser and Node I/O are identical.
- That all codec licences are MIT.
- That npm download counts equal active users.
- That a browser graph can always be imported without adapting DOM, permission, or lifecycle assumptions.

The strongest honest realtime claim is “simple measured graphs render faster than realtime.” The strongest broad claim is “the Web Audio API shape outside the browser.”

## Open questions

These need author or user evidence rather than inference:

1. Which cohort drives durable use: CI testing, server rendering, command-line audio, Tone.js, or live I/O?
2. Do users choose pure JavaScript because of deployment constraints, inspectability, Deno/Bun support, or avoidance of native builds?
3. Which decoded formats appear in real workloads, and which codec licences are acceptable to those users?
4. Is the default speaker behavior desirable for library users, or should headless output be the safer default?
5. How many production users need low-latency realtime output rather than offline or batch rendering?
6. Which browser libraries beyond Tone.js are important enough to become compatibility fixtures?
7. Should streaming decode become an explicit Web Audio source API, or remain an adapter example?

Suggested interviews:

- “What happened immediately before you installed this package?”
- “What would you have used if it did not exist?”
- “Which graph did you move, and what failed first?”
- “Was your first successful result a buffer, a speaker, a stream, or a test?”
- “What almost made you choose the Rust binding or a headless browser instead?”
- “Which runtime and deployment target made native dependencies costly?”

## Decisions and kill list

Keep:

- The exact Web Audio API category name.
- Runnable examples as the primary proof.
- Direct, inspectable commands and source.
- Honest realtime and worklet limits.
- AudioJS attribution without turning it into navigation furniture.

Remove or avoid:

- A navigation bar when the page has one task.
- Separate Browser, Node, and CI code tabs.
- Decorative waveforms that prove nothing.
- Repeated sections saying the same portability claim.
- A second catalogue index with duplicate UI; canonical detail pages remain for each example.
- Internal implementation questions in the public FAQ.
- A monolithic shared example file whose functions cannot be inspected independently.
- Competitor tables with unsourced checkmarks or a predetermined winner.

## Sources

Primary project evidence:

- Repository and issues: https://github.com/audiojs/web-audio-api
- WPT runner and tests in this repository.
- Benchmarks in `benchmark/compare.js` and `benchmark/scenarios.js`.
- npm download API: https://api.npmjs.org/downloads/point/last-year/web-audio-api
- npm package metadata: https://www.npmjs.com/package/web-audio-api

Decoding:

- `@audio/decode`: https://github.com/audiojs/decode
- npm metadata: https://www.npmjs.com/package/@audio/decode

Audio I/O:

- `@audio/speaker`: https://github.com/audiojs/speaker
- `@audio/mic`: https://github.com/audiojs/mic

Alternatives:

- `node-web-audio-api`: https://github.com/ircam-ismm/node-web-audio-api
- `web-audio-api-rs`: https://docs.rs/web-audio-api/latest/web_audio_api/
- `standardized-audio-context`: https://github.com/chrisguttandin/standardized-audio-context
- `web-audio-engine`: https://github.com/mohayonao/web-audio-engine

Research limitation:

- The configured Exa backend was unavailable during the 2026-08-29 review. Claims above therefore use repository code, issue history, npm metadata, official project documentation, and local measurements rather than broad web-search summaries.
