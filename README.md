# web-audio-api [![test](https://github.com/audiojs/web-audio-api/actions/workflows/test.yml/badge.svg)](https://github.com/audiojs/web-audio-api/actions/workflows/test.yml)

Portable [Web Audio API](https://webaudio.github.io/web-audio-api/) for any JS environment. **100% [WPT](https://web-platform-tests.org/) conformance**.

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

### Real-time output

If [`speaker`](https://npmjs.com/speaker) is installed, audio plays automatically. Otherwise falls back to stdout:

```js
import { AudioContext } from 'web-audio-api'

const ctx = new AudioContext()
await ctx.resume() // per W3C spec, AudioContext starts suspended

const osc = ctx.createOscillator()
osc.connect(ctx.destination)
osc.start()
// → plays through speaker (if installed), or pipe: node synth.js | aplay -f cd
```

Custom output stream:

```js
ctx.outStream = new Speaker({ channels: 2, bitDepth: 16, sampleRate: 44100 })
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



## Alternatives

| Implementation | Portable | Conformance | Runtimes | Status |
|---|---|---|---|---|
| **web-audio-api** | Yes | 100% WPT | Node/Deno/Bun/edge/serverless | active |
| [node-web-audio-api](https://github.com/ircam-ismm/node-web-audio-api) | No (native addon) | ~75% WPT | Node only | active |
| [web-audio-api-rs](https://github.com/orottier/web-audio-api-rs) | No (Rust binary) | WPT tracked | Rust/WASM | active |
| [web-audio-engine](https://github.com/nicol-ograve/web-audio-engine)| Yes | minimal | Node | archived 2019 |
| [standardized-audio-context](https://github.com/nicol-ograve/standardized-audio-context) | Browser only | browser-native | browser polyfill | active |

## Limitations

- **Performance** — pure JS is fast for most use cases but won't match native implementations for sustained heavy real-time DSP (dozens of simultaneous convolver/panner nodes). WASM kernels are planned.
- **`outStream`** — the only API surface outside the W3C spec. It's the bridge to audio output (speaker, stdout, stream). Browsers handle this internally.
- **AudioWorklet threading** — runs synchronously on the main thread. Browsers use a separate audio thread. Functionally identical, but no thread isolation.

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
