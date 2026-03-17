# web-audio-api [![test](https://github.com/audiojs/web-audio-api/actions/workflows/test.yml/badge.svg)](https://github.com/audiojs/web-audio-api/actions/workflows/test.yml)

Pure JS implementation of [Web Audio API](https://www.w3.org/TR/webaudio/) — runs in Node.js, Deno, Bun, serverless, and edge runtimes.

## Implemented

- AudioContext (state machine, suspend/resume/close, baseLatency)
- OfflineAudioContext (startRendering, oncomplete)
- AudioParam (automation events, a-rate/k-rate, cancelScheduledValues)
- AudioBuffer (via [audio-buffer](https://github.com/audiojs/audio-buffer))
- AudioBufferSourceNode
- ConstantSourceNode
- OscillatorNode (sine/square/sawtooth/triangle/custom via PeriodicWave)
- GainNode
- StereoPannerNode
- PannerNode (3D spatial, equalpower, distance/cone models)
- DelayNode
- BiquadFilterNode (8 filter types, Audio EQ Cookbook)
- WaveShaperNode (with 2x/4x oversampling)
- IIRFilterNode (Direct Form II Transposed)
- ConvolverNode (time-domain, normalize)
- DynamicsCompressorNode (soft knee, envelope follower)
- ChannelSplitterNode / ChannelMergerNode
- AnalyserNode (radix-2 FFT, Blackman window)
- ScriptProcessorNode (deprecated but supported)

## Install

```
npm install web-audio-api
```

## Usage

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

### Piping to aplay (Linux)

```js
import { AudioContext } from 'web-audio-api'
const ctx = new AudioContext()
ctx.outStream = process.stdout
```

```sh
node script.js | aplay -f cd
```

## Architecture

Pull-based audio graph. `AudioDestinationNode` pulls from the graph via `_tick()`, each node pulls its inputs recursively. 128-sample blocks (spec render quantum). Buffer reuse throughout — no allocation in hot paths.

```
EventTarget ← Emitter ← DspObject ← AudioNode ← concrete nodes
                                    ← AudioParam
EventTarget ← Emitter ← AudioPort ← AudioInput / AudioOutput
EventTarget ← AudioContext
```

New nodes extend `AudioNode`, override `_tick()`, optionally separate DSP into static functions for future WASM swap.

## Alternatives

- [node-web-audio-api](https://github.com/ircam-ismm/node-web-audio-api) — Rust/napi-rs, native addon (Node.js only)
- [web-audio-api-rs](https://github.com/orottier/web-audio-api-rs) — pure Rust
- [web-audio-engine](https://github.com/mohayonao/web-audio-engine) — JS, archived 2019

## License

MIT

<p align="center">🕉</p>
