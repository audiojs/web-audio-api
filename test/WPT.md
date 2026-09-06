# Web Platform Test coverage

Run `npm run wpt` to execute the checked-in Web Audio test corpus against this implementation. Run `npm run site:verify` to record the passing count, package version, and timestamp in `site-metrics.json` and rebuild the website.

The count is the number of passing testharness subtests, not the number of files. CI runs on Node. Other runtime smoke tests do not establish equivalent conformance coverage.

## Scope

The runner discovers HTML tests under `test/wpt/webaudio`. These exercise graph construction, node processing, automation, channel mixing, lifecycle behavior, and the APIs available in this corpus. A full pass is evidence for that corpus under this harness, not W3C certification or proof that every browser behavior is reproduced.

Device latency, real hardware, browser permissions, DOM integration, operating-system codecs, and AudioWorklet thread isolation are not established by this run. The implementation executes worklets synchronously. Media-element playback is not implemented in Node.

## Harness adaptations

`test/wpt-runner.js` supplies a simulated browser environment:

- A linkedom document and emulated browser globals, events, media streams, and device IDs.
- Context subclasses that avoid speakers, simulate activation, and advance rendering under runner control.
- Custom loading for test resources and worklet modules. Browser testdriver infrastructure is not loaded.
- DOMException assertions compare exception names across VM realms instead of constructor identity. This is narrower than a native browser assertion.
- A missing approximate-array helper is supplied using testharness length and element assertions.
- The checked-in `testInvalidConstructor_W3CTH` helper contains `new window` where it needs a named constructor. The runner replaces that helper with constructor checks.

These adaptations are inspectable in the runner. Keep them separate from engine changes and review them when updating the corpus. Do not weaken assertions to obtain a green result.

`test/wpt.test.js` also checks the approximate-array fallback with empty arrays, length and final-element mismatches, tolerance boundaries, and nonfinite values. These synthetic runner checks assert exact pass/fail outcomes and are not included in the published corpus count.

## Reproducing a website result

Normal site builds validate saved WPT metadata and benchmark report structure/statistics before rewriting pages. They do not rerun WPT; use `npm run site:verify` for fresh test evidence.

The homepage links to the CI workflow and shows the version and date from `site-metrics.json`. To reproduce, check out that package version or the CI commit, install its locked dependencies with `npm ci`, and run `npm run wpt`. The checked-in corpus revision is recorded by git.
