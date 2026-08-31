# Todo

## Archived website implementation checklist

This records the first site implementation and is no longer the active information architecture. See [`website.md`](website.md) for current user research, positioning, evidence, decisions, and open questions. Checked items below mean the original implementation addressed them; they do not require every former section to remain visible.

**Status:** implemented and verified on 2026-08-29. “Ready,” “experimental,” and “build next” labels on the page describe the underlying library/use-case maturity; every checklist item below refers to the website’s coverage, implementation, or explicit boundary.

### Review overrides

- [x] Remove the homepage waveform demo; it added no evidence. Keep meaningful live demos on the dedicated example pages.
- [x] Replace Browser/Node/CI code tabs with one code block and runtime import comments.
- [x] Use Geist for headings, prose, and UI. Keep Orbitron only in the AudioJS product mark.
- [x] Use conventional section names and remove the duplicate portability and full-index sections.
- [x] Add MicroLighter syntax highlighting with an unhighlighted progressive fallback.

### Essence and positioning

- [x] Lead with the concrete category: **Web Audio, without the browser**.
- [x] Explain the irreducible job: write one Web Audio graph, then play it in a browser, run it in Node, render it offline, or test it in CI.
- [x] Name the primary audience: Web Audio and Tone.js developers who need browser-standard audio in Node, CI, servers, bots, and scripts.
- [x] Serve the secondary audience through task pages: Node developers searching for a specific audio job rather than for “Web Audio API.”
- [x] Keep creative coders and musicians as a discovery audience without positioning the library as a synth toy.
- [x] Explicitly decline the wrong category: this is not a DAW, generic playground, new audio abstraction, or replacement for MDN.
- [x] Use an honest onliness claim only: pure-JavaScript, WPT-complete Web Audio runtime for Node; do not publish an unverified market-wide “only” claim.
- [x] Make the first five minutes prove the proposition instead of arguing it.

### Value proposition and proof

- [x] Present situation → problem → implication → payoff in the user’s language.
- [x] Contrast the real alternatives: browser-only native Web Audio, native Node bindings, partial/archived JS engines, and rewriting the graph.
- [x] Show current conformance as measured proof, not decorative badge copy.
- [x] Show pure JavaScript and no native dependencies as the portability mechanism.
- [x] Show headless `OfflineAudioContext` rendering as the CI mechanism.
- [x] Show Tone.js compatibility as a real integration, including dynamic-import ordering.
- [x] Show Node extensions (`sinkId`, inline worklet registration, `CustomMediaStreamTrack`) as practical escape hatches.
- [x] Surface package version, WPT count, example count, and tested runtimes from generated site data so they cannot drift silently.
- [x] Keep npm/GitHub popularity subordinate to stronger proof; never use vanity metrics as the argument.

### Target-user journeys

- [x] Evaluator path: headline → install and basic code → conformance/runtime proof → meaningful example.
- [x] Browser/Tone migration path: one graph block with runtime import comments → polyfill guide → runnable program.
- [x] Backend task path: search result → focused example → observable output → complete `.mjs` source.
- [x] CI path: offline render → deterministic assertion → no speaker/device setup.
- [x] Creative exploration path: browse examples → change parameters → hear result → take it to CLI.
- [x] Production-fit path: compatibility → measured performance → honest limits → alternatives.
- [x] Make every route deep-linkable and useful without requiring a homepage detour.

### Portable-example proposition

- [x] Explain the proposition once: one graph can play, render, or test; avoid a separate portability showcase.
- [x] Split runtime-neutral graph construction from Browser and CLI wrappers.
- [x] Do not claim two separately rewritten snippets are “the same example.”
- [x] Label engines honestly: Browser uses native `AudioContext`; Node/CI use `web-audio-api`.
- [x] Preserve rich CLI wrappers while extracting shared graph cores for featured practical examples.
- [x] Give every example its own stable, search-targeted page.
- [x] Give every example a live result when the browser can support the job.
- [x] Give every example the exact existing Node command and source.
- [x] Give every example one graph-code view with Browser/Node/CI import comments, the exact Node command, and the complete CLI source link.
- [x] State expected output, graph path, inputs, outputs, APIs used, caveats, and related examples.
- [x] Provide silent copy-to-clipboard feedback; no celebratory toast.
- [x] Include all 33 existing examples in the catalog, grouped by user job and existing domain category.
- [x] Lead the use-case index with practical examples; keep illusions in the catalog as discovery rather than positioning.

### Homepage content

- [x] Dense one-page introduction with a compact header and direct install action.
- [x] Superseded after review: remove the above-fold waveform demo; keep direct install and basic code above the fold, with runnable audio on example pages.
- [x] Proof strip: current WPT total, runnable-example count, native-dependency count, and tested CI runtimes.
- [x] Job index: render, test, process, analyze, capture, stream, port, synthesize.
- [x] Link practical examples directly from the use-case index: offline render, CI test, file processing, Tone.js, FFT analysis, PCM piping, microphone level, reference tone.
- [x] Show Browser, Node, and CI as import comments in one code block rather than three adapter panels.
- [x] Link to the full searchable catalog once; do not duplicate its 33-entry index on the homepage.
- [x] Compatibility matrix for Node, Deno, Bun, Browser preview, Tone.js, and headless CI.
- [x] Performance and architecture section with measured current state.
- [x] Alternatives section that is factual and respectful.
- [x] FAQ covering suspended contexts, close, Tone.js, file decoding, microphone capture, unit testing, speed, and real-time limits.
- [x] Closing AudioJS statement and prominent link to the broader AudioJS organization.

### Serious and unusual adjacent uses

- [x] Golden-audio regression tests: assert samples, peak, frequency, duration, or hashes.
- [x] Audio QA in CI: detect silence, clipping, DC offset, channel mistakes, and spectral regressions.
- [x] Build-time audio asset compiler: data/parameters → generated sound assets.
- [x] Browser/Node differential renderer: run one graph in both engines and compare output.
- [x] Deterministic ML/audio stimulus generation with seeded variations.
- [x] Personalized audio APIs: notifications, sonic identities, game assets, and generated responses.
- [x] Voice-bot and telephony DSP: PCM, gain/EQ, DTMF, and writable streams.
- [x] Acoustic test bench: tone, sweep, impulse, stereo/polarity, and microphone measurement with volume warning.
- [x] Executable audio notebooks: share a browser result, take home a reproducible `.mjs` graph.
- [x] Data sonification: metrics or scientific data to deterministic sound.
- [x] Mark the strongest immediate categories clearly: audio testing, audio compilation, and the portable example corpus.

### Low-latency and future engine lane

- [x] State the current boundary: pull-based 128-frame rendering; AudioWorklet currently synchronous without thread isolation.
- [x] Do not imply present native-grade low-latency parity.
- [x] Signal the active JZ/WASM direction: compile hot JavaScript DSP kernels to WASM for realtime/worklet use.
- [x] Link JZ and label that lane experimental/in progress rather than shipped.
- [x] Keep live WebRTC/server mixing as a promising adjacent use, not the headline promise.

### Canonical structure and visual system

- [x] Use a proof-led reference-page structure: code and measured project data are the imagery; working previews live on example pages.
- [x] Use AudioJS-family design DNA: ink/paper split, restrained teal accent, strong wordmark, waveform as functional motif.
- [x] Combine AudioJS identity with watr-like density: narrow reading measures, exact tables, visible code, minimal marketing furniture.
- [x] Use one accent, no gradients, no generic feature cards, no card-in-card, no fake browser/code chrome.
- [x] Use Geist for display, prose, and UI; Orbitron for the wordmark only; IBM Plex Mono for code.
- [x] Use a 4-point spacing scale and locked OKLCH design tokens.
- [x] Keep motion to functional example waveforms, button feedback, and copy feedback.
- [x] Respect reduced motion and never autoplay sound.
- [x] Use a slab navigation and a statement footer that closes with AudioJS.

### Trust, metadata, and discovery

- [x] Add canonical title/description, Open Graph, Twitter card, and SoftwareSourceCode structured data.
- [x] Add per-example search titles, descriptions, canonical URLs, and HowTo/SoftwareSourceCode structured data.
- [x] Add sitemap and robots files.
- [x] Set the package homepage to the website.
- [x] Avoid hardcoded release/test/example claims where generation can source them.
- [x] Expose version drift honestly; do not pretend stale GitHub releases or changelog entries are current proof.
- [x] Make the site ready to become the target of the existing AudioJS “Web Audio API” mention.

### Accessibility and interaction quality

- [x] Semantic landmarks and heading order.
- [x] Keyboard-operable filters, controls, details, and copy actions; runtime tabs were removed.
- [x] Visible unanimated focus rings with sufficient contrast.
- [x] Touch targets at least 44×44 CSS pixels.
- [x] No information conveyed by color alone.
- [x] `aria-live` for graph/demo status without noisy repeated announcements.
- [x] Proper labels, helper/error text, and stable control geometry.
- [x] No clickable labels wrapping to two lines.
- [x] No horizontal page scroll at 320, 375, 414, or 768 px.
- [x] Honor `prefers-reduced-motion` and `prefers-contrast` where useful.
- [x] Include safe audio-volume language on headphone, sweep, impulse, and measurement demos.

### Implementation and verification

- [x] Keep the site static and framework-free; progressive enhancement only.
- [x] Generate all example pages from one catalog to prevent content drift.
- [x] Keep browser controls and rendered CLI option lists in one schema, checked against every CLI’s `--help` output.
- [x] Smoke-test all 33 CLI entry points through `--help` and execute every refactored CLI with real audio or offline output.
- [x] Add a build/staging script and GitHub Pages workflow.
- [x] Add automated structural tests for routes, metadata, catalog completeness, links, and accessibility primitives.
- [x] Test all generated pages through a local HTTP server.
- [x] Verify desktop and 320/375/414/768 responsive layouts in a real browser.
- [x] Verify keyboard navigation and reduced-motion rendering.
- [x] Run `npm test` after shared example-core changes.
- [x] Run the complete WPT suite and preserve 100% conformance.
- [x] Run the Hallmark slop test and remove every failing tell.

### Kill list — keep these absent

- [x] No generic “Portable Web Audio API” hero.
- [x] No homepage dump of 33 equal cards.
- [x] No API-node taxonomy as primary navigation.
- [x] No separately maintained Browser/Node graph implementations for featured demos.
- [x] No autoplay, fake terminal/browser chrome, custom cursor, parallax, or universal scroll reveals.
- [x] No unverified “runs everywhere,” edge, low-latency, wellness, or performance claims.
- [x] No invented testimonials, users, logos, metrics, or adoption stories.
- [x] No generic four-column SaaS footer or oversized navigation furniture.
