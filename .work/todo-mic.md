# Mic example + FAQ (feedback #35)

- [x] Create `examples/mic.js` — live mic → speakers pass-through via `MediaStreamAudioSourceNode.pushData()`, driven by `audio-mic`
- [x] Update `README.md`:
  - [x] Add FAQ entry: "How do I capture audio from the microphone?"
  - [x] Add `mic.js` row to Examples table (API section)
- [x] Verify example file loads/imports cleanly (syntax check)
- [x] Full test suite passes (300/300 — including 3 new mic-pattern tests)
- [x] Added integration tests in `test/MediaStreamNodes.test.js` (audio-mic-style spirit): mono Int16 PCM flow, stereo deinterleave, continuous chunk queueing
