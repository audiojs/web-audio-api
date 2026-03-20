# web-audio-api [![test](https://github.com/audiojs/web-audio-api/actions/workflows/test.yml/badge.svg)](https://github.com/audiojs/web-audio-api/actions/workflows/test.yml)

Portable [Web Audio API](https://webaudio.github.io/web-audio-api/) for any JS environment. 100% [WPT](https://web-platform-tests.org/) conformance.

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
// → plays through speakers
```

Audio output is built-in via [`audio-speaker`](https://github.com/audiojs/audio-speaker) — no extra packages needed.

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

### Custom output stream

For piping to external tools or custom sinks, set `outStream` to any writable:

```js
ctx.outStream = myWritableStream
```

```sh
node synth.js | aplay -f cd
```

### Polyfill

Register Web Audio API globals for environments that lack them:

```js
import 'web-audio-api/polyfill'

// AudioContext, OfflineAudioContext, GainNode, etc. are now global
```

### Testing audio code

```js
import { OfflineAudioContext } from 'web-audio-api'
import { test } from 'node:test'
import { strictEqual } from 'node:assert'

test('gain halves amplitude', async () => {
  const ctx = new OfflineAudioContext(1, 128, 44100)
  const src = ctx.createConstantSource()
  const gain = ctx.createGain()
  gain.gain.value = 0.5
  src.connect(gain).connect(ctx.destination)
  src.start()
  const buf = await ctx.startRendering()
  strictEqual(buf.getChannelData(0)[0], 0.5)
})
```


## Examples

Run any example: `node examples/<name>.js` — real-time examples play sound through speakers.

| Example | |
|---------|---|
| [speaker.js](examples/speaker.js) | Hello world — play a tone |
| [sweep.js](examples/sweep.js) | Frequency sweep 100Hz → 4kHz |
| [subtractive-synth.js](examples/subtractive-synth.js) | Sawtooth → filter sweep → ADSR |
| [noise.js](examples/noise.js) | AudioWorklet noise → bandpass filter |
| [lfo.js](examples/lfo.js) | Tremolo via LFO modulation |
| [spatial.js](examples/spatial.js) | PannerNode — sound moves left to right |
| [sequencer.js](examples/sequencer.js) | Step sequencer with precise scheduling |
| [worklet.js](examples/worklet.js) | AudioWorkletProcessor with custom param |
| [linked-params.js](examples/linked-params.js) | ConstantSourceNode controlling multiple gains |
| [fft.js](examples/fft.js) | AnalyserNode — frequency spectrum |
| [render-to-buffer.js](examples/render-to-buffer.js) | OfflineAudioContext → buffer |
| [process-file.js](examples/process-file.js) | Read audio file → EQ + compress → render |
| [pipe-stdout.js](examples/pipe-stdout.js) | Pipe PCM to system player |

## Alternatives

| | Language | Runs in | Native deps | WPT | Offline rendering |
|---|---|---|---|---|---|
| [web-audio-api](https://github.com/audiojs/web-audio-api) | JS | Node, Bun, Deno, browser | none | 100% | yes |
| [node-web-audio-api](https://github.com/ircam-ismm/node-web-audio-api) | Rust (napi) | Node only | platform binary | partial | yes |
| [standardized-audio-context](https://github.com/chrisguttandin/standardized-audio-context) | JS | Browser only | none | n/a (wraps native) | browser only |
| [web-audio-api-rs](https://github.com/orottier/web-audio-api-rs) | Rust | Rust / WASM | Rust toolchain | partial | yes |

**Choose this package** when you need portable spec-compliant Web Audio in any JS environment &mdash; testing, offline rendering, SSR, or lightweight real-time playback.<br>
**Choose node-web-audio-api** when you need maximum DSP throughput on Node.js and can accept the native dependency.<br>
**Choose standardized-audio-context** when you target browsers and need a uniform API across vendor differences.<br>
**Choose web-audio-api-rs** for Rust-native or WASM projects (not an npm package).

Also: [web-audio-engine](https://github.com/mohayonao/web-audio-engine) &mdash; earlier pure-JS effort (archived 2019), inspiration for this project.

Rendering 1s of audio at 44.1kHz (`npm run bench:all`):

| Scenario | web-audio-api (JS) | node-web-audio-api (Rust) | Chrome (native) |
|---|---|---|---|
| OscillatorNode | 0.3ms | 0.3ms | 0.4ms |
| Osc &rarr; Gain | 0.4ms | 0.2ms | 0.4ms |
| Osc &rarr; BiquadFilter | 0.9ms | 0.4ms | 0.5ms |
| DynamicsCompressor | 2.0ms | 0.5ms | 1.2ms |
| ConvolverNode (128-tap) | 4.4ms | 1.6ms | 0.4ms |
| 8-voice polyphony | 2.3ms | 1.8ms | 1.2ms |

All scenarios run faster than real-time. Pure JS matches Rust on simple graphs; heavier DSP (convolution, compression) is 2&ndash;4&times; slower &mdash; WASM kernels are planned for these paths.

## Limitations

- **Performance** — pure JS is fast for most use cases but won't match native implementations for sustained heavy real-time DSP (dozens of simultaneous convolver/panner nodes). WASM kernels are planned.
- **`outStream`** — the only API surface outside the W3C spec. It's the bridge to custom audio output (stdout, streams). Default output uses `audio-speaker` and needs no configuration.
- **AudioWorklet threading** — runs synchronously on the main thread. Browsers use a separate audio thread. Functionally identical, but no thread isolation.

## FAQ

<dl>

<dt>How do I close/dispose an AudioContext?</dt>
<dd>

```js
await ctx.close() // stops rendering, releases resources
```
Or with [explicit resource management](https://github.com/tc39/proposal-explicit-resource-management): `using ctx = new AudioContext()`
</dd>

<dt>Why does AudioContext start suspended?</dt>
<dd>

Per the [W3C spec](https://webaudio.github.io/web-audio-api/#dom-audiocontext-audiocontext). Browsers require user activation before audio can play. Call `await ctx.resume()` to start, or use `OfflineAudioContext` which doesn't need it.
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
import { readFileSync } from 'node:fs'
const ctx = new OfflineAudioContext(2, 1, 44100)
const buffer = await ctx.decodeAudioData(readFileSync('track.mp3'))
```
Supports WAV, MP3, FLAC, OGG, AAC, and [more](https://github.com/audiojs/audio-decode).
</dd>

<dt>Can I use it as a browser polyfill?</dt>
<dd>

```js
import 'web-audio-api/polyfill' // registers AudioContext, OfflineAudioContext, etc. as globals
```
</dd>

<dt>What about performance?</dt>
<dd>

All nodes run faster than real-time on a single thread (`npm run bench`). For heavy real-time workloads (many convolvers/panners), consider [node-web-audio-api](https://github.com/ircam-ismm/node-web-audio-api) which uses Rust.
</dd>

</dl>

## Architecture

Pull-based audio graph. `AudioDestinationNode` pulls upstream via `_tick()`, 128-sample render quanta per the spec. DSP kernels separated from graph plumbing for future WASM swap.

```
EventTarget ← Emitter ← DspObject ← AudioNode ← concrete nodes
                                    ← AudioParam
EventTarget ← Emitter ← AudioPort ← AudioInput / AudioOutput
```

## License

MIT

<p align=center><a href="https://github.com/krishnized/license/">ॐ</a></p>
