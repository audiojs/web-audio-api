# web-audio-api [![test](https://github.com/audiojs/web-audio-api/actions/workflows/test.yml/badge.svg)](https://github.com/audiojs/web-audio-api/actions/workflows/test.yml)

Portable [Web Audio API](https://webaudio.github.io/web-audio-api/) for any JS environment. **100% [WPT](https://web-platform-tests.org/) conformance**.

## Install

```
npm install web-audio-api
```

## Use

```js
import { AudioContext } from 'web-audio-api'

const ctx = new AudioContext({ sampleRate: 44100 })
ctx.outStream = writableStream // provide output destination

const osc = ctx.createOscillator()
osc.frequency.value = 440
osc.connect(ctx.destination)
osc.start()
```


## Real-time output (Node.js)

```js
import { AudioContext } from 'web-audio-api'
import Speaker from 'speaker'

const ctx = new AudioContext()
ctx.outStream = new Speaker({
  channels: ctx.format.numberOfChannels,
  bitDepth: ctx.format.bitDepth,
  sampleRate: ctx.sampleRate
})
await ctx.resume()

const osc = ctx.createOscillator()
osc.connect(ctx.destination)
osc.start()
```

Or pipe raw PCM to any audio sink:


```sh
node script.js | aplay -f cd
```

### Offline rendering

```js
import { OfflineAudioContext } from 'web-audio-api'

const ctx = new OfflineAudioContext(2, 44100 * 5, 44100)

const osc = ctx.createOscillator()
osc.connect(ctx.destination)
osc.start()

const buffer = await ctx.startRendering()
// buffer: AudioBuffer with 5 seconds of audio
```

## Testing audio code

```js
import { OfflineAudioContext } from 'web-audio-api'
import test from 'node:test'

test('gain halves amplitude', async () => {
  const ctx = new OfflineAudioContext(1, 128, 44100)
  const src = ctx.createConstantSource()
  const gain = ctx.createGain()
  gain.gain.value = 0.5
  src.connect(gain).connect(ctx.destination)
  src.start()
  const buf = await ctx.startRendering()
  assert.strictEqual(buf.getChannelData(0)[0], 0.5)
})
```


## Alternatives

| Implementation | Portable | Conformance | Runtimes | Status |
|---|---|---|---|---|
| **web-audio-api** | Yes | 100% WPT | Node/Deno/Bun/edge/serverless | active |
| [node-web-audio-api](https://github.com/ircam-ismm/node-web-audio-api) (ircam) | No (native addon) | ~75% WPT | Node only | active |
| [web-audio-api-rs](https://github.com/orottier/web-audio-api-rs) (orottier) | No (Rust binary) | WPT tracked | Rust/WASM | active |
| web-audio-engine (mohayonao) | Yes | minimal | Node | archived 2019 |
| standardized-audio-context | Browser only | browser-native | browser polyfill | active |


## Architecture

Pull-based audio graph. `AudioDestinationNode` pulls from upstream via `_tick()`, 128-sample blocks (spec render quantum). Zero allocation in hot paths — buffers pre-allocated and reused.

```
EventTarget ← Emitter ← DspObject ← AudioNode ← concrete nodes
                                    ← AudioParam
EventTarget ← Emitter ← AudioPort ← AudioInput / AudioOutput
```

DSP kernels are separated from graph plumbing for future WASM swap.

## License

MIT

<p align=center><a href="https://github.com/krishnized/license/">ॐ</a></p>
