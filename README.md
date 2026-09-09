# <img src="assets/logo.svg" width="28" valign="middle" alt=""> web-audio-api [![W3C WPT](https://github.com/audiojs/web-audio-api/actions/workflows/wpt.yml/badge.svg)](https://github.com/audiojs/web-audio-api/actions/workflows/wpt.yml) [![platforms](https://github.com/audiojs/web-audio-api/actions/workflows/platforms.yml/badge.svg)](https://github.com/audiojs/web-audio-api/actions/workflows/platforms.yml) [![npm](https://img.shields.io/npm/v/web-audio-api)](https://npmjs.org/package/web-audio-api)

A pure JavaScript implementation of the [Web Audio API](https://audiojs.dev/web-audio-api/) for Node.js. Render existing audio graphs on the server, test audio processing in CI, or play sound through your speakers.

```
npm install web-audio-api
```

## Use

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

This renders one second of a 440 Hz tone into memory without opening an audio device. Use the samples in a test or save them to a file. See [render-to-buffer.js](examples/render-to-buffer.js).

<details>
<summary><b>Where does it run?</b></summary>

Node.js has the broadest test coverage, including the fully passing checked-in [WPT corpus under our Node runner](test/WPT.md). Deno and Bun run offline rendering checks in CI. See the [runtime support details](https://audiojs.dev/web-audio-api/#faq) for device access and other targets.

</details>

<details>
<summary><b>How to use it as a polyfill?</b></summary>

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

</details>

<details>
<summary><b>Does it work with Tone.js?</b></summary>

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

</details>

<details>
<summary><b>How to decode audio files?</b></summary>

```js
const buffer = await ctx.decodeAudioData(readFileSync('track.mp3'))
```
`decodeAudioData()` uses [@audio/decode](https://github.com/audiojs/decode) for MP3, WAV, Ogg Vorbis, Opus, FLAC, AAC, ALAC, AIFF, CAF, WebM, and other supported audio or video containers without FFmpeg or native bindings.

</details>

<details>
<summary><b>How to play sound through speakers?</b></summary>

```js
import { AudioContext } from 'web-audio-api'

const ctx = new AudioContext()
await ctx.resume()

const osc = ctx.createOscillator()
osc.frequency.value = 440
osc.connect(ctx.destination)
osc.onended = () => ctx.close()
osc.start()
osc.stop(ctx.currentTime + 1) // play for one second, then close the device
```

[`@audio/speaker`](https://github.com/audiojs/speaker) provides device output through platform-specific backends, including native dependencies. The DSP engine itself is JavaScript.

</details>

<details>
<summary id="how-do-i-capture-audio-from-the-microphone"><b>How to capture audio from the microphone?</b></summary>

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

</details>

<details>
<summary><b>Why does it start suspended?</b></summary>

`AudioContext` starts suspended to match the [Web Audio lifecycle](https://webaudio.github.io/web-audio-api/#dom-audiocontext-audiocontext). In Node, call `await ctx.resume()`. Browsers may require that call inside a user gesture. `OfflineAudioContext` doesn't need it.

</details>

<details>
<summary><b>How to close an AudioContext?</b></summary>

```js
await ctx.close()
```
Or with [explicit resource management](https://github.com/tc39/proposal-explicit-resource-management): `using ctx = new AudioContext()`

</details>

## Examples

46 runnable examples cover rendering, analysis, synthesis, and PCM streaming.

`node examples/<name>.js` runs each example with its defaults.
`node examples/<name>.js --help` for every accepted argument, option, keyboard control, and alternate invocation.

<details>
<summary id="api"><b>API</b></summary>

* [speaker.js](examples/speaker.js): Hello world
* [lfo.js](examples/lfo.js): Tremolo via LFO
* [spatial.js](examples/spatial.js): Sound moving through space
* [worklet.js](examples/worklet.js): Custom AudioWorkletProcessor
* [linked-params.js](examples/linked-params.js): One source controlling many gains
* [fft.js](examples/fft.js): Frequency spectrum
* [render-to-buffer.js](examples/render-to-buffer.js): Offline render → buffer
* [process-file.js](examples/process-file.js): Audio file → EQ + compress → render
* [pipe-stdout.js](examples/pipe-stdout.js): PCM to stdout – pipe to `aplay`, `sox`, etc.
* [mic.js](examples/mic.js): Live microphone → speakers with RMS meter (requires [`@audio/mic`](https://github.com/audiojs/mic))
* [recorder.js](examples/recorder.js): Record the mic to a WAV file, with a level meter (requires [`@audio/mic`](https://github.com/audiojs/mic))
* [reverb.js](examples/reverb.js): Convolver with a seeded impulse response – `2 0.35 3s`

</details>

<details>
<summary id="test-signals"><b>Test signals</b></summary>

* [tone.js](examples/tone.js): Reference pitch – `sine A4 2s`
* [sweep.js](examples/sweep.js): Hear the audible range – `20..20k exp 3s`
* [noise.js](examples/noise.js): White, pink, brown, blue, violet – `pink 2s`
* [impulse.js](examples/impulse.js): Dirac click – `5 0.5s`
* [dtmf.js](examples/dtmf.js): Dial a phone number – `5551234`
* [stereo-test.js](examples/stereo-test.js): Left, right, center – `1k 1s`
* [metronome.js](examples/metronome.js): Programmable stick click – `80..240 10m X-x-x-x-`
* [tuner.js](examples/tuner.js): Guitar tuner – mic pitch in cents – `440` (requires [`@audio/mic`](https://github.com/audiojs/mic))
* [latency-tester.js](examples/latency-tester.js): Round-trip latency: speakers → mic, in ms (requires [`@audio/mic`](https://github.com/audiojs/mic))
* [level-meter.js](examples/level-meter.js): Mic RMS and peak in dBFS, fast or slow ballistics (requires [`@audio/mic`](https://github.com/audiojs/mic))

</details>

<details>
<summary id="synthesis"><b>Synthesis</b></summary>

* [subtractive-synth.js](examples/subtractive-synth.js): Sawtooth → filter sweep → ADSR
* [additive.js](examples/additive.js): Waveforms from harmonics – `square 220 16 3s`
* [fm-synthesis.js](examples/fm-synthesis.js): DX7 frequency modulation – `440 2 5 3s`
* [karplus-strong.js](examples/karplus-strong.js): A string plucked from noise – `A4 4s`
* [wavetable.js](examples/wavetable.js): Fourier wavetables, crossfaded – `organ 220 0.3 6s`
* [granular.js](examples/granular.js): Grain cloud from a seeded buffer – `0.08 15 4 10s`

</details>

<details>
<summary id="generative"><b>Generative</b></summary>

[Musical models, styles, and offline listening fixtures](examples/MUSIC.md).

* [sequencer.js](examples/sequencer.js): Step sequencer – precise timing
* [serial.js](examples/serial.js): Twelve-tone rows (Webern) – `72 30s`
* [gamelan.js](examples/gamelan.js): Balinese kotekan – two parts, one melody – `120 20s`
* [drone.js](examples/drone.js): Tanpura, pads, or cinematic strings – `voice=strings melody=pentatonic freq=D3 -d 30s`
* [jazz.js](examples/jazz.js): Jazz in seven styles, modal first, lead on guitar, flute, harp, or piano – `style=ambient lead=harp`
* [euclidean.js](examples/euclidean.js): Bjorklund rhythms, 2–3 voices – `120 16 3,5,7 20s`

</details>

<details>
<summary id="illusions"><b>Illusions</b></summary>

* [shepard.js](examples/shepard.js): Pitch that rises forever – `up 15s`
* [risset-rhythm.js](examples/risset-rhythm.js): Beat that accelerates forever – `up 120 20s`
* [binaural-beats.js](examples/binaural-beats.js): Third tone from two (headphones!) – `200 10 10s`
* [missing-fundamental.js](examples/missing-fundamental.js): Your brain fills in the note – `100 3s`
* [beating.js](examples/beating.js): Two close frequencies dance – `440 3 5s`
* [octave-illusion.js](examples/octave-illusion.js): One tone jumps register and side (headphones!) – `400 800 2 12s`
* [scale-illusion.js](examples/scale-illusion.js): Two scales split between ears, regrouped by pitch (headphones!) – `200 261.63 8s`
* [tritone-paradox.js](examples/tritone-paradox.js): Up or down? Tritone pairs that refuse to decide – `0 8 1.2`
* [continuity.js](examples/continuity.js): A tone sounds unbroken through noise bursts – `440 0.6 on 15s`
* [streaming.js](examples/streaming.js): Two tones fuse into one stream or split into two – `240 4 15s`
* [huggins-pitch.js](examples/huggins-pitch.js): A pitch that exists in neither ear (headphones!) – `600 20s`
* [zwicker-tone.js](examples/zwicker-tone.js): An after-tone lingers where the notch was – `2000 3 2 20s`

</details>

## Performance

Run `npm run bench:compare` for an offline-render comparison with `node-web-audio-api`. The runner alternates engines after warmup and reports median and p95 times over 50 renders. [Saved results](benchmark/results.json) include raw samples, hardware, and versions.

These are short offline graphs, not audio-device latency measurements or realtime guarantees. Measure your own graph and deployment host.

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

- **[node-web-audio-api](https://github.com/ircam-ismm/node-web-audio-api)** – Rust DSP with Node bindings and native prebuilds; its browser export uses native Web Audio. Compare on your graph, especially when realtime performance matters.
- **[standardized-audio-context](https://github.com/chrisguttandin/standardized-audio-context)** – Browser-only. Normalizes cross-browser quirks.
- **[web-audio-api-rs](https://github.com/orottier/web-audio-api-rs)** – Pure Rust / WASM.
- **[web-audio-engine](https://github.com/mohayonao/web-audio-engine)** – Archived. Partial spec coverage.
- **[react-native-audio-api](https://github.com/software-mansion/react-native-audio-api)** – React native partial implementation.

## License

MIT

<p align=center><a href="https://github.com/krishnized/license/">ॐ</a></p>
