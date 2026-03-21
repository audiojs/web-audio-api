# web-audio-api [![test](https://github.com/audiojs/web-audio-api/actions/workflows/test.yml/badge.svg)](https://github.com/audiojs/web-audio-api/actions/workflows/test.yml)

Portable [Web Audio API](https://webaudio.github.io/web-audio-api/) for Node.js. No native dependencies. 100% [WPT](https://web-platform-tests.org/) conformance.

```
npm install web-audio-api
```

## Use

```js
import { AudioContext } from 'web-audio-api'

const ctx = new AudioContext()
await ctx.resume()

const osc = ctx.createOscillator()
osc.frequency.value = 440
osc.connect(ctx.destination)
osc.start()
// → A440 through your speakers
```

Built-in speaker output via [`audio-speaker`](https://github.com/audiojs/audio-speaker) — no extra setup.

### Offline rendering

```js
import { OfflineAudioContext } from 'web-audio-api'

const ctx = new OfflineAudioContext(2, 44100, 44100) // 1 second, stereo
const osc = ctx.createOscillator()
osc.frequency.value = 440
osc.connect(ctx.destination)
osc.start()

const buffer = await ctx.startRendering()
// buffer.getChannelData(0) → Float32Array of 44100 samples
```

## Examples

`node examples/<name>.js` — all parametric. Positional args or `key=value` with prefix matching (`f=440`, `freq=440` both work). Note names (`A4`, `C#3`, `Eb5`), `k` for kHz (`20k`), `s`/`m`/`h` for duration (`10m`).

| Example | |
|---|---|
| **Test Signals** | |
| [tone.js](examples/tone.js) | Reference pitch — `sine A4 2s` |
| [sweep.js](examples/sweep.js) | Hear the audible range — `20..20k exp 3s` |
| [noise.js](examples/noise.js) | White, pink, brown, blue, violet — `pink 2s` |
| [impulse.js](examples/impulse.js) | Dirac click — `5 0.5s` |
| [dtmf.js](examples/dtmf.js) | Dial a phone number — `5551234` |
| [stereo-test.js](examples/stereo-test.js) | Left, right, center — `1k 1s` |
| [metronome.js](examples/metronome.js) | Programmable click — `120..240 10m X-x-` |
| **Illusions** | |
| [shepard.js](examples/shepard.js) | Pitch that rises forever — `up 15s` |
| [risset-rhythm.js](examples/risset-rhythm.js) | Beat that accelerates forever — `up 120 20s` |
| [binaural-beats.js](examples/binaural-beats.js) | Third tone from two (headphones!) — `200 10 10s` |
| [missing-fundamental.js](examples/missing-fundamental.js) | Your brain fills in the note — `100 3s` |
| [beating.js](examples/beating.js) | Two close frequencies dance — `440 3 5s` |
| **Synthesis** | |
| [subtractive-synth.js](examples/subtractive-synth.js) | Sawtooth → filter sweep → ADSR |
| [additive.js](examples/additive.js) | Waveforms from harmonics — `square 220 16 3s` |
| [fm-synthesis.js](examples/fm-synthesis.js) | DX7 frequency modulation — `440 2 5 3s` |
| [karplus-strong.js](examples/karplus-strong.js) | A string plucked from noise — `A4 4s` |
| **Generative** | |
| [sequencer.js](examples/sequencer.js) | Step sequencer — precise timing |
| [serial.js](examples/serial.js) | Twelve-tone rows (Webern) — `72 30s` |
| [gamelan.js](examples/gamelan.js) | Balinese kotekan — two parts, one melody — `120 20s` |
| [drone.js](examples/drone.js) | Tanpura shimmer — `C3 30s` |
| [jazz.js](examples/jazz.js) | Modal jazz — new every time |
| **API** | |
| [speaker.js](examples/speaker.js) | Hello world |
| [lfo.js](examples/lfo.js) | Tremolo via LFO |
| [spatial.js](examples/spatial.js) | Sound moving through space |
| [worklet.js](examples/worklet.js) | Custom AudioWorkletProcessor |
| [linked-params.js](examples/linked-params.js) | One source controlling many gains |
| [fft.js](examples/fft.js) | Frequency spectrum |
| [render-to-buffer.js](examples/render-to-buffer.js) | Offline render → buffer |
| [process-file.js](examples/process-file.js) | Audio file → EQ + compress → render |
| [pipe-stdout.js](examples/pipe-stdout.js) | PCM to stdout — pipe to `aplay`, `sox`, etc. |

## Node extensions

Beyond the spec, for Node.js. Not portable to browsers.

- **`addModule(fn)`** — register a processor via callback instead of URL, no file needed
- **`sinkId: stream`** — pipe PCM to any writable: `new AudioContext({ sinkId: process.stdout })` then `node synth.js | aplay -f cd`
- **`numberOfChannels`, `bitDepth`** — control output format in the constructor

## FAQ

<dl>

<dt>How do I close an AudioContext?</dt>
<dd>

```js
await ctx.close()
```
Or with [explicit resource management](https://github.com/tc39/proposal-explicit-resource-management): `using ctx = new AudioContext()`
</dd>

<dt>Why does it start suspended?</dt>
<dd>

Per [W3C spec](https://webaudio.github.io/web-audio-api/#dom-audiocontext-audiocontext) — browsers require user gesture before audio plays. Call `await ctx.resume()` to start. `OfflineAudioContext` doesn't need it.
</dd>

<dt>Does it work with Tone.js?</dt>
<dd>

```js
import { AudioContext } from 'web-audio-api'
import * as Tone from 'tone'
Tone.setContext(new AudioContext())
```
</dd>

<dt>How do I decode audio files?</dt>
<dd>

```js
const buffer = await ctx.decodeAudioData(readFileSync('track.mp3'))
```
WAV, MP3, FLAC, OGG, AAC via [audio-decode](https://github.com/audiojs/audio-decode).
</dd>

<dt>How do I use it as a polyfill?</dt>
<dd>

```js
import 'web-audio-api/polyfill'
// AudioContext, GainNode, etc. are now global
```
</dd>

<dt>Can I unit-test audio code?</dt>
<dd>

`OfflineAudioContext` renders without speakers — pair with any test runner. See [render-to-buffer.js](examples/render-to-buffer.js).
</dd>

<dt>How fast is it?</dt>
<dd>

All scenarios render faster than real-time. Pure JS matches Rust napi on simple graphs; heavier DSP (convolution, compression) is 2–4× slower — WASM kernels planned. `npm run bench:all` to measure.
</dd>

</dl>

## Alternatives

- **[node-web-audio-api](https://github.com/ircam-ismm/node-web-audio-api)** — Rust napi bindings. Faster heavy DSP, but Node-only with native compilation and partial spec.
- **[standardized-audio-context](https://github.com/chrisguttandin/standardized-audio-context)** — Browser-only. Normalizes cross-browser quirks.
- **[web-audio-api-rs](https://github.com/orottier/web-audio-api-rs)** — Pure Rust / WASM.
- **[web-audio-engine](https://github.com/mohayonao/web-audio-engine)** — Archived. Partial spec coverage.

## Architecture

Pull-based audio graph. `AudioDestinationNode` pulls upstream via `_tick()`, 128-sample render quanta per spec. AudioWorklet runs synchronously (no thread isolation). DSP kernels separated from graph plumbing for future WASM swap.

```
EventTarget ← Emitter ← DspObject ← AudioNode ← concrete nodes
                                    ← AudioParam
EventTarget ← Emitter ← AudioPort ← AudioInput / AudioOutput
```

## License

MIT

<p align=center><a href="https://github.com/krishnized/license/">ॐ</a></p>
