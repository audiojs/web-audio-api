# web-audio-api [![test](https://github.com/audiojs/web-audio-api/actions/workflows/test.yml/badge.svg)](https://github.com/audiojs/web-audio-api/actions/workflows/test.yml)

Web Audio API in pure JavaScript — 99% [Web Platform Tests](https://github.com/nicolo-ribaudo/tc39-proposal-structs/blob/main/test/test262) conformance.

Runs in Node.js, Deno, Bun, serverless, and edge runtimes — anywhere native addons can't.

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

### Node.js with speaker

```js
import { AudioContext } from 'web-audio-api'
import Speaker from 'speaker'

const ctx = new AudioContext()
ctx.outStream = new Speaker({
  channels: ctx.format.numberOfChannels,
  bitDepth: ctx.format.bitDepth,
  sampleRate: ctx.sampleRate
})
```

### Pipe to system audio

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

## When to use what

| | Language | Runs everywhere | Spec conformance |
|---|---|---|---|
| **web-audio-api** | Pure JS | Node, Deno, Bun, edge, serverless | 99% WPT |
| [node-web-audio-api](https://github.com/ircam-ismm/node-web-audio-api) | Rust (napi-rs) | Node.js only | ~75% WPT |
| [web-audio-api-rs](https://github.com/orottier/web-audio-api-rs) | Pure Rust | Rust only | — |

**Use this** if you need audio processing outside a browser, want to test Web Audio code in CI, or need audio in serverless/edge environments.

**Use `node-web-audio-api`** if you're on Node.js only and need native performance for heavy real-time workloads.

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
