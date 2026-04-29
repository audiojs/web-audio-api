import test from 'tst'
import { is, ok, almost } from 'tst'
import AudioContext from '../src/AudioContext.js'
import AudioNode from '../src/AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { fill } from 'audio-buffer/util'
import { MediaStreamAudioSourceNode, MediaStreamAudioDestinationNode } from '../src/MediaStreamAudioSourceNode.js'
import createMediaStream from '../src/createMediaStream.js'
import { BLOCK_SIZE } from '../src/constants.js'

let mkCtx = () => new AudioContext()

test('MediaStreamAudioSourceNode > outputs pushed data', () => {
  let ctx = mkCtx()
  let node = new MediaStreamAudioSourceNode(ctx, { numberOfChannels: 1 })

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
  ok(dest.stream.getAudioTracks().length > 0, 'has audio track')
})

test('ctx.createMediaStreamSource > from createMediaStreamDestination stream', () => {
  let ctx = mkCtx()
  let dest = ctx.createMediaStreamDestination()
  let src = ctx.createMediaStreamSource(dest.stream)
  ok(src, 'created')
  ok(src.mediaStream === dest.stream, 'retains mediaStream reference')
})

test('ctx.createMediaStreamSource > rejects non-MediaStream input', () => {
  let ctx = mkCtx()
  let threw = false
  try { ctx.createMediaStreamSource([]) } catch { threw = true }
  ok(threw, 'plain array rejected (use createMediaStream to wrap)')
})

// createMediaStream(): Node-side adapter that wraps a PCM source into a spec-shaped
// MediaStream, usable with the spec-standard ctx.createMediaStreamSource(stream).

test('createMediaStream > produces spec-compliant MediaStream shape', () => {
  let stream = createMediaStream([new Float32Array(BLOCK_SIZE)])
  let tracks = stream.getAudioTracks()
  is(tracks.length, 1, 'has exactly one audio track')
  is(tracks[0].kind, 'audio', 'track kind is audio')
  ok(typeof stream.getTracks === 'function', 'getTracks() available')
  is(stream.getVideoTracks().length, 0, 'no video tracks')
  let ctx = mkCtx()
  ok(ctx.createMediaStreamSource(stream), 'accepted by createMediaStreamSource')
})

test('createMediaStream > Float32Array (mono) → graph', () => {
  let ctx = mkCtx()
  let block = new Float32Array(BLOCK_SIZE).fill(0.5)
  let stream = createMediaStream([block])
  let src = ctx.createMediaStreamSource(stream)

  ctx._state = 'running'
  let out = src._tick()
  almost(out.getChannelData(0)[0], 0.5, 1e-6, 'Float32Array flows through graph')
})

test('createMediaStream > Int16 LE PCM Buffer (audio-mic shape) → mono Float32', () => {
  let ctx = mkCtx()
  let pcm = Buffer.alloc(BLOCK_SIZE * 2)
  for (let i = 0; i < BLOCK_SIZE; i++) pcm.writeInt16LE(Math.round(0.5 * 32767), i * 2)
  let stream = createMediaStream([pcm], { channels: 1, bitDepth: 16 })
  let src = ctx.createMediaStreamSource(stream)

  ctx._state = 'running'
  let out = src._tick()
  almost(out.getChannelData(0)[0], 0.5, 1e-4, 'Int16 PCM decoded to [-1,1]')
  almost(out.getChannelData(0)[BLOCK_SIZE - 1], 0.5, 1e-4, 'last sample preserved')
})

test('createMediaStream > stereo interleaved Int16 PCM → planar Float32', () => {
  let ctx = mkCtx()
  let pcm = Buffer.alloc(BLOCK_SIZE * 2 * 2)
  for (let i = 0; i < BLOCK_SIZE; i++) {
    pcm.writeInt16LE(Math.round(0.3 * 32767), (i * 2) * 2)
    pcm.writeInt16LE(Math.round(-0.4 * 32767), (i * 2 + 1) * 2)
  }
  let stream = createMediaStream([pcm], { channels: 2, bitDepth: 16 })
  let src = ctx.createMediaStreamSource(stream)

  ctx._state = 'running'
  let out = src._tick()
  is(out.numberOfChannels, 2, 'stereo output')
  almost(out.getChannelData(0)[0], 0.3, 1e-4, 'left channel preserved')
  almost(out.getChannelData(1)[0], -0.4, 1e-4, 'right channel preserved')
})

test('createMediaStream > callback-style reader (audio-mic shape)', async () => {
  let ctx = mkCtx()
  let values = [0.1, 0.2, 0.3]
  let idx = 0
  let read = (cb) => {
    if (idx >= values.length) return cb(null, null)
    let chunk = new Float32Array(BLOCK_SIZE).fill(values[idx++])
    queueMicrotask(() => cb(null, chunk))
  }
  let stream = createMediaStream(read)
  let src = ctx.createMediaStreamSource(stream)

  await new Promise(r => setTimeout(r, 10))
  ctx._state = 'running'
  for (let v of values) {
    almost(src._tick().getChannelData(0)[0], v, 1e-6, `chunk ${v} drained in order`)
  }
  is(src._tick().getChannelData(0)[0], 0, 'silence after reader EOF')
})

test('createMediaStream > async iterable source', async () => {
  let ctx = mkCtx()
  async function* gen() {
    yield new Float32Array(BLOCK_SIZE).fill(0.25)
    yield new Float32Array(BLOCK_SIZE).fill(-0.25)
  }
  let stream = createMediaStream(gen())
  let src = ctx.createMediaStreamSource(stream)

  await new Promise(r => setTimeout(r, 10))
  ctx._state = 'running'
  almost(src._tick().getChannelData(0)[0], 0.25, 1e-6, 'first chunk')
  almost(src._tick().getChannelData(0)[0], -0.25, 1e-6, 'second chunk')
})
