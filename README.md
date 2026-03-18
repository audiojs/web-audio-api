# web-audio-api [![test](https://github.com/audiojs/web-audio-api/actions/workflows/test.yml/badge.svg)](https://github.com/audiojs/web-audio-api/actions/workflows/test.yml)

Portable Web Audio API — 99% [Web Platform Tests](https://github.com/nicolo-ribaudo/tc39-proposal-structs/blob/main/test/test262) conformance.

Runs in Node.js, Deno, Bun, serverless, and edge runtimes — no native compilation required.

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

| | Portable | Conformance | Runtimes |
|---|---|---|---|
| **web-audio-api** | Yes — no native compilation | 99% WPT | Node, Deno, Bun, edge, serverless |
| [node-web-audio-api](https://github.com/ircam-ismm/node-web-audio-api) | No — Rust native addon | ~75% WPT | Node.js only |
| [web-audio-api-rs](https://github.com/orottier/web-audio-api-rs) | No — Rust binary | — | Rust only |

**Use this** if you need the Web Audio API outside a browser — servers, CLI, CI testing, serverless, edge.

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
