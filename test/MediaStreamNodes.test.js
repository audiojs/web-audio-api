import test from 'tst'
import { is, ok, almost } from 'tst'
import AudioContext from '../src/AudioContext.js'
import AudioNode from '../src/AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { fill } from 'audio-buffer/util'
import { MediaStreamAudioSourceNode, MediaStreamAudioDestinationNode } from '../src/MediaStreamAudioSourceNode.js'
import { BLOCK_SIZE } from '../src/constants.js'

let mkCtx = () => new AudioContext()

test('MediaStreamAudioSourceNode > outputs pushed data', () => {
  let ctx = mkCtx()
  let node = new MediaStreamAudioSourceNode(ctx, { numberOfChannels: 1 })

  // push a block of audio
  let data = new Float32Array(BLOCK_SIZE)
  data.fill(0.6)
  node.pushData(data)

  ctx._state = 'running'
  let buf = node._tick()
  is(buf.numberOfChannels, 1)
  almost(buf.getChannelData(0)[0], 0.6, 1e-6, 'outputs pushed data')
})

test('MediaStreamAudioSourceNode > outputs silence when no data', () => {
  let ctx = mkCtx()
  let node = new MediaStreamAudioSourceNode(ctx, { numberOfChannels: 1 })

  ctx._state = 'running'
  let buf = node._tick()
  is(buf.getChannelData(0)[0], 0, 'silence when empty')
})

test('MediaStreamAudioDestinationNode > captures audio to stream', () => {
  let ctx = mkCtx()
  let dest = new MediaStreamAudioDestinationNode(ctx, { numberOfChannels: 1 })
  let src = new AudioNode(ctx, 0, 1)
  src.connect(dest)
  src._tick = () => fill(new AudioBuffer(1, BLOCK_SIZE, 44100), 0.7)

  ctx._state = 'running'
  dest._tick()

  ok(dest.stream.readable, 'stream has data')
  let chunk = dest.stream.read()
  ok(chunk, 'chunk available')
  is(chunk.length, 1, '1 channel')
  almost(chunk[0][0], 0.7, 1e-6, 'captured audio data')
})

test('MediaStreamAudioDestinationNode > stream', () => {
  let ctx = mkCtx()
  let dest = ctx.createMediaStreamDestination()
  ok(dest.stream, 'has stream property')
})

test('factory > createMediaStreamSource', () => {
  let ctx = mkCtx()
  let node = ctx.createMediaStreamSource(null)
  ok(node, 'created')
})

// Integration test for the "capture mic in Node" pattern documented in README FAQ
// and examples/mic.js. Simulates audio-mic's output (Int16 LE PCM Buffer) and
// verifies it flows through MediaStreamAudioSourceNode.pushData() into the graph.
test('MediaStreamAudioSourceNode > mic FAQ pattern: Int16 PCM buffer → pushData → graph output', () => {
  let ctx = mkCtx()
  let src = new MediaStreamAudioSourceNode(ctx, { numberOfChannels: 1 })

  // Simulate audio-mic callback: interleaved Int16 LE PCM Buffer, one block worth of frames.
  let pcm = Buffer.alloc(BLOCK_SIZE * 2) // mono, 16-bit → 2 bytes/frame
  for (let i = 0; i < BLOCK_SIZE; i++) {
    // fill with a known non-zero value so we can verify it comes through
    pcm.writeInt16LE(Math.round(0.5 * 32767), i * 2)
  }

  // Conversion shown in FAQ / examples/mic.js: Int16 LE → Float32 [-1, 1]
  let f32 = new Float32Array(BLOCK_SIZE)
  for (let i = 0; i < BLOCK_SIZE; i++) f32[i] = pcm.readInt16LE(i * 2) / 32768
  src.pushData(f32)

  ctx._state = 'running'
  let out = src._tick()
  is(out.numberOfChannels, 1, 'mono output')
  almost(out.getChannelData(0)[0], 0.5, 1e-4, 'pushed PCM sample reaches output')
  almost(out.getChannelData(0)[BLOCK_SIZE - 1], 0.5, 1e-4, 'last sample of block preserved')
})

test('MediaStreamAudioSourceNode > mic FAQ pattern: stereo Int16 PCM → deinterleave → pushData', () => {
  let ctx = mkCtx()
  let src = new MediaStreamAudioSourceNode(ctx, { numberOfChannels: 2 })

  // Simulated interleaved Int16 stereo PCM (LRLRLR…)
  let pcm = Buffer.alloc(BLOCK_SIZE * 2 * 2) // 2 ch × 2 bytes
  for (let i = 0; i < BLOCK_SIZE; i++) {
    pcm.writeInt16LE(Math.round(0.3 * 32767), (i * 2) * 2)       // L
    pcm.writeInt16LE(Math.round(-0.4 * 32767), (i * 2 + 1) * 2)  // R
  }

  // Deinterleave (as shown in examples/mic.js for stereo path)
  let left = new Float32Array(BLOCK_SIZE)
  let right = new Float32Array(BLOCK_SIZE)
  for (let i = 0; i < BLOCK_SIZE; i++) {
    left[i] = pcm.readInt16LE((i * 2) * 2) / 32768
    right[i] = pcm.readInt16LE((i * 2 + 1) * 2) / 32768
  }
  src.pushData([left, right])

  ctx._state = 'running'
  let out = src._tick()
  is(out.numberOfChannels, 2, 'stereo output')
  almost(out.getChannelData(0)[0], 0.3, 1e-4, 'left channel preserved')
  almost(out.getChannelData(1)[0], -0.4, 1e-4, 'right channel preserved')
})

test('MediaStreamAudioSourceNode > mic FAQ pattern: continuous chunks are queued and drained', () => {
  let ctx = mkCtx()
  let src = new MediaStreamAudioSourceNode(ctx, { numberOfChannels: 1 })

  // Simulate three back-to-back mic callback chunks (one block each, distinct values)
  let values = [0.1, 0.2, 0.3]
  for (let v of values) {
    let f32 = new Float32Array(BLOCK_SIZE)
    f32.fill(v)
    src.pushData(f32)
  }

  ctx._state = 'running'
  for (let v of values) {
    let out = src._tick()
    almost(out.getChannelData(0)[0], v, 1e-6, `chunk with value ${v} drained in order`)
  }

  // After queue is empty, output is silence
  let silent = src._tick()
  is(silent.getChannelData(0)[0], 0, 'silence after queue drained')
})
