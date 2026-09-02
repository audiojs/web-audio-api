# web-audio-api [![W3C WPT](https://github.com/audiojs/web-audio-api/actions/workflows/wpt.yml/badge.svg)](https://github.com/audiojs/web-audio-api/actions/workflows/wpt.yml) [![platforms](https://github.com/audiojs/web-audio-api/actions/workflows/platforms.yml/badge.svg)](https://github.com/audiojs/web-audio-api/actions/workflows/platforms.yml) [![npm](https://img.shields.io/npm/v/web-audio-api)](https://npmjs.org/package/web-audio-api)

[Web Audio](https://audiojs.dev/web-audio-api/): headless & cross-platform.

* **100% [WPT](https://web-platform-tests.org/) conformance**, no native bindings, no compile.
* **Audio in CI** – `OfflineAudioContext` renders without speakers.
* **CLI audio scripting** – pipe, process, synthesize from terminal.
* **Server-side audio** – generate from APIs, bots, pipelines.
* **Tone.js and web audio libs** work in Node as-is.

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

[`@audio/speaker`](https://github.com/audiojs/speaker) provides speaker output without extra setup.

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

`node examples/<name>.js` runs each example with its defaults. Each CLI is a thin adapter over a standalone `examples/graphs/<name>.js` module; the website imports that same graph into the browser’s native Web Audio context. Use `node examples/<name>.js --help` for every accepted argument, option, keyboard control, and alternate invocation. Parametric examples accept positional args or `key=value` with prefix matching (`f=440`, `freq=440` both work). Note names (`A4`, `C#3`, `Eb5`), `k` for kHz (`20k`), and `s`/`m`/`h` for duration (`10m`) are supported.

| Example | |
|---|---|
| **Test Signals** | |
| [tone.js](examples/tone.js) | Reference pitch – `sine A4 2s` |
| [sweep.js](examples/sweep.js) | Hear the audible range – `20..20k exp 3s` |
| [noise.js](examples/noise.js) | White, pink, brown, blue, violet – `pink 2s` |
| [impulse.js](examples/impulse.js) | Dirac click – `5 0.5s` |
| [dtmf.js](examples/dtmf.js) | Dial a phone number – `5551234` |
| [stereo-test.js](examples/stereo-test.js) | Left, right, center – `1k 1s` |
| [metronome.js](examples/metronome.js) | Programmable stick click – `80..240 10m X-x-x-x-` |
| [tuner.js](examples/tuner.js) | Guitar tuner – mic pitch in cents – `440` (requires [`@audio/mic`](https://github.com/audiojs/mic)) |
| [latency-tester.js](examples/latency-tester.js) | Round-trip latency: speakers → mic, in ms (requires [`@audio/mic`](https://github.com/audiojs/mic)) |
| [level-meter.js](examples/level-meter.js) | Mic RMS and peak in dBFS, fast or slow ballistics (requires [`@audio/mic`](https://github.com/audiojs/mic)) |
| **Illusions** | |
| [shepard.js](examples/shepard.js) | Pitch that rises forever – `up 15s` |
| [risset-rhythm.js](examples/risset-rhythm.js) | Beat that accelerates forever – `up 120 20s` |
| [binaural-beats.js](examples/binaural-beats.js) | Third tone from two (headphones!) – `200 10 10s` |
| [missing-fundamental.js](examples/missing-fundamental.js) | Your brain fills in the note – `100 3s` |
| [beating.js](examples/beating.js) | Two close frequencies dance – `440 3 5s` |
| [octave-illusion.js](examples/octave-illusion.js) | One tone jumps register and side (headphones!) – `400 800 2 12s` |
| [scale-illusion.js](examples/scale-illusion.js) | Two scales split between ears, regrouped by pitch (headphones!) – `200 261.63 8s` |
| [tritone-paradox.js](examples/tritone-paradox.js) | Up or down? Tritone pairs that refuse to decide – `0 8 1.2` |
| [continuity.js](examples/continuity.js) | A tone sounds unbroken through noise bursts – `440 0.6 on 15s` |
| [streaming.js](examples/streaming.js) | Two tones fuse into one stream or split into two – `240 4 15s` |
| [huggins-pitch.js](examples/huggins-pitch.js) | A pitch that exists in neither ear (headphones!) – `600 20s` |
| [zwicker-tone.js](examples/zwicker-tone.js) | An after-tone lingers where the notch was – `2000 3 2 20s` |
| **Synthesis** | |
| [subtractive-synth.js](examples/subtractive-synth.js) | Sawtooth → filter sweep → ADSR |
| [additive.js](examples/additive.js) | Waveforms from harmonics – `square 220 16 3s` |
| [fm-synthesis.js](examples/fm-synthesis.js) | DX7 frequency modulation – `440 2 5 3s` |
| [karplus-strong.js](examples/karplus-strong.js) | A string plucked from noise – `A4 4s` |
| [wavetable.js](examples/wavetable.js) | Fourier wavetables, crossfaded – `organ 220 0.3 6s` |
| [granular.js](examples/granular.js) | Grain cloud from a seeded buffer – `0.08 15 4 10s` |
| **Generative** | |
| [sequencer.js](examples/sequencer.js) | Step sequencer – precise timing |
| [serial.js](examples/serial.js) | Twelve-tone rows (Webern) – `72 30s` |
| [gamelan.js](examples/gamelan.js) | Balinese kotekan – two parts, one melody – `120 20s` |
| [drone.js](examples/drone.js) | Tanpura shimmer – `C3 30s` |
| [jazz.js](examples/jazz.js) | Modal jazz – new every time |
| [euclidean.js](examples/euclidean.js) | Bjorklund rhythms, 2–3 voices – `120 16 3,5,7 20s` |
| **API** | |
| [speaker.js](examples/speaker.js) | Hello world |
| [lfo.js](examples/lfo.js) | Tremolo via LFO |
| [spatial.js](examples/spatial.js) | Sound moving through space |
| [worklet.js](examples/worklet.js) | Custom AudioWorkletProcessor |
| [linked-params.js](examples/linked-params.js) | One source controlling many gains |
| [fft.js](examples/fft.js) | Frequency spectrum |
| [render-to-buffer.js](examples/render-to-buffer.js) | Offline render → buffer |
| [process-file.js](examples/process-file.js) | Audio file → EQ + compress → render |
| [pipe-stdout.js](examples/pipe-stdout.js) | PCM to stdout – pipe to `aplay`, `sox`, etc. |
| [mic.js](examples/mic.js) | Live microphone → speakers with RMS meter (requires [`@audio/mic`](https://github.com/audiojs/mic)) |
| [recorder.js](examples/recorder.js) | Record the mic to a WAV file, with a level meter (requires [`@audio/mic`](https://github.com/audiojs/mic)) |
| [reverb.js](examples/reverb.js) | Convolver with a seeded impulse response – `2 0.35 3s` |

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

`AudioContext` starts suspended to match the [Web Audio lifecycle](https://webaudio.github.io/web-audio-api/#dom-audiocontext-audiocontext). In Node, call `await ctx.resume()`. Browsers may require that call inside a user gesture. `OfflineAudioContext` doesn't need it.
</dd>

<dt>Does it work with Tone.js?</dt>
<dd>

Yes. Tone.js uses `standardized-audio-context`, which needs globals such as `window.AudioParam` for `instanceof` checks. Load the polyfill before Tone.js:

```js
import 'web-audio-api/polyfill'
const Tone = await import('tone')

Tone.setContext(new AudioContext())
const synth = new Tone.Synth().toDestination()
synth.triggerAttackRelease('C4', '8n')
```

Tone.js must use a dynamic `import()` because static imports run before the polyfill. Alternatively, use `--import`:

```sh
node --import web-audio-api/polyfill app.js
```

Then static `import * as Tone from 'tone'` works in `app.js`.
</dd>

<dt>How do I decode audio files?</dt>
<dd>

```js
const buffer = await ctx.decodeAudioData(readFileSync('track.mp3'))
```
`decodeAudioData()` uses [@audio/decode](https://github.com/audiojs/decode) for MP3, WAV, Ogg Vorbis, Opus, FLAC, AAC, ALAC, AIFF, CAF, WebM, and other supported audio or video containers without FFmpeg or native bindings.
</dd>

<dt id="how-do-i-capture-audio-from-the-microphone">How do I capture audio from the microphone?</dt>
<dd>

In Node, pair [`@audio/mic`](https://github.com/audiojs/mic) with `CustomMediaStreamTrack`:

```sh
npm install @audio/mic
```

```js
import { AudioContext, MediaStreamAudioSourceNode, CustomMediaStreamTrack, MediaStream } from 'web-audio-api'
import mic from '@audio/mic'

const ctx = new AudioContext()
await ctx.resume()

const track = new CustomMediaStreamTrack({
  kind: 'audio',
  label: 'mic',
  settings: { channelCount: 1, sampleSize: 16, sampleRate: ctx.sampleRate }
})
const stream = new MediaStream([track])

const src = new MediaStreamAudioSourceNode(ctx, { mediaStream: stream })
src.connect(ctx.destination) // live monitor

// @audio/mic's read(cb) is single-shot; re-arm it inside the callback.
const read = mic({ sampleRate: ctx.sampleRate, channels: 1, bitDepth: 16 })
const pump = () => read((err, buf) => {
  if (err || !buf) return
  track.pushData(buf, { channels: 1, bitDepth: 16 })
  pump()
})
pump()
```

`track.pushData()` accepts `Float32Array`, `Float32Array[]`, or interleaved 8/16/32-bit integer PCM buffers. Integer PCM conversion uses `pcm-convert`. `CustomMediaStreamTrack` extends `MediaStreamTrack`. Prior art: `CanvasCaptureMediaStreamTrack`.

See [examples/mic.js](examples/mic.js) for a runnable demo with gain and VU meter. To record the graph to a buffer, use `OfflineAudioContext.startRendering()`. To capture live graph output as a stream, use `ctx.createMediaStreamDestination()`.

If the default microphone backend cannot open the device, pass `backend: 'process'` to use `sox`/`ffmpeg` instead: `mic({ ..., backend: 'process' })`. All bundled examples accept `backend=process` on the command line.
</dd>

<dt>How do I use it as a polyfill?</dt>
<dd>

```js
import 'web-audio-api/polyfill'
// AudioContext, GainNode, etc. are now global
```

The polyfill also installs `navigator.mediaDevices.getUserMedia({ audio: true })`, backed by the optional [`@audio/mic`](https://github.com/audiojs/mic) peer dependency. This lets browser mic-capture code run verbatim in Node:

```js
import 'web-audio-api/polyfill'
// npm install @audio/mic

const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
const ctx = new AudioContext()
const src = ctx.createMediaStreamSource(stream)
src.connect(ctx.destination)

// stop capture
stream.getAudioTracks()[0].stop()
```

Without `@audio/mic` installed, `getUserMedia` rejects with a `NotFoundError` containing an install hint.
</dd>

<dt>Can I unit-test audio code?</dt>
<dd>

Use `OfflineAudioContext` with any test runner; it renders without speakers. See [render-to-buffer.js](examples/render-to-buffer.js).
</dd>

<dt>How fast is it?</dt>
<dd>

All benchmark scenarios render faster than real time. Pure JS matches Rust napi on simple graphs. Convolution and compression are 2–4× slower. The [JZ/WASM path](https://jz.js.org/) is experimental. Run `npm run bench:all` to measure.
</dd>

</dl>

## Architecture

Pull-based audio graph. `AudioDestinationNode` pulls upstream via `_tick()`, 128-sample render quanta per spec. AudioWorklet runs synchronously (no thread isolation). DSP kernels separated from graph plumbing for future WASM swap.

```
EventTarget ← Emitter ← DspObject ← AudioNode ← concrete nodes
                                    ← AudioParam
EventTarget ← Emitter ← AudioPort ← AudioInput / AudioOutput
```

## Node extensions

Beyond the spec, for Node.js. Not portable to browsers.

- **`addModule(fn)`** – register a processor via callback instead of URL, no file needed
- **`sinkId: stream`** – pipe PCM to any writable: `new AudioContext({ sinkId: process.stdout })` then `node synth.js | aplay -f cd`
- **`numberOfChannels`, `bitDepth`** – control output format in the constructor.
- **`CustomMediaStreamTrack`** – extends `MediaStreamTrack` with a public constructor and `pushData(chunk, options)` to feed audio data (e.g. from a microphone). Prior art: `CanvasCaptureMediaStreamTrack`. See the [mic FAQ](#how-do-i-capture-audio-from-the-microphone).

## Alternatives

- **[node-web-audio-api](https://github.com/ircam-ismm/node-web-audio-api)** – Rust napi bindings. Faster heavy DSP, but node-only with compilation step and partial spec.
- **[standardized-audio-context](https://github.com/chrisguttandin/standardized-audio-context)** – Browser-only. Normalizes cross-browser quirks.
- **[web-audio-api-rs](https://github.com/orottier/web-audio-api-rs)** – Pure Rust / WASM.
- **[web-audio-engine](https://github.com/mohayonao/web-audio-engine)** – Archived. Partial spec coverage.
- **[react-native-audio-api](https://github.com/software-mansion/react-native-audio-api)** – React native partial implementation.

## License

MIT

<p align=center><a href="https://github.com/krishnized/license/">ॐ</a></p>
