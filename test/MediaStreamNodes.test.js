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
  ok(threw, 'plain array rejected')
})

test('MediaStreamAudioSourceNode > pushData converts Int16 PCM buffer', () => {
  let ctx = mkCtx()
  let src = new MediaStreamAudioSourceNode(ctx, { numberOfChannels: 1 })
  let pcm = Buffer.alloc(BLOCK_SIZE * 2)
  for (let i = 0; i < BLOCK_SIZE; i++) pcm.writeInt16LE(Math.round(0.5 * 32767), i * 2)
  src.pushData(pcm, { channels: 1, bitDepth: 16 })

  ctx._state = 'running'
  let out = src._tick()
  almost(out.getChannelData(0)[0], 0.5, 1e-4, 'Int16 PCM decoded to [-1,1]')
  almost(out.getChannelData(0)[BLOCK_SIZE - 1], 0.5, 1e-4, 'last sample preserved')
})

test('MediaStreamAudioSourceNode > pushData deinterleaves stereo PCM buffer', () => {
  let ctx = mkCtx()
  let src = new MediaStreamAudioSourceNode(ctx, { numberOfChannels: 2 })
  let pcm = Buffer.alloc(BLOCK_SIZE * 2 * 2)
  for (let i = 0; i < BLOCK_SIZE; i++) {
    pcm.writeInt16LE(Math.round(0.3 * 32767), (i * 2) * 2)
    pcm.writeInt16LE(Math.round(-0.4 * 32767), (i * 2 + 1) * 2)
  }
  src.pushData(pcm, { channels: 2, bitDepth: 16 })

  ctx._state = 'running'
  let out = src._tick()
  is(out.numberOfChannels, 2, 'stereo output')
  almost(out.getChannelData(0)[0], 0.3, 1e-4, 'left channel preserved')
  almost(out.getChannelData(1)[0], -0.4, 1e-4, 'right channel preserved')
})

test('MediaStreamAudioSourceNode > queued chunks drain in order', () => {
  let ctx = mkCtx()
  let src = new MediaStreamAudioSourceNode(ctx, { numberOfChannels: 1 })
  let values = [0.1, 0.2, 0.3]
  for (let v of values) src.pushData(new Float32Array(BLOCK_SIZE).fill(v))

  ctx._state = 'running'
  for (let v of values) {
    let out = src._tick()
    almost(out.getChannelData(0)[0], v, 1e-6, `chunk ${v} drained in order`)
  }
  is(src._tick().getChannelData(0)[0], 0, 'silence after reader EOF')
})

test('MediaStreamAudioSourceNode > short chunks fill the same quantum', () => {
  let ctx = mkCtx()
  let src = new MediaStreamAudioSourceNode(ctx, { numberOfChannels: 1 })
  src.pushData(new Float32Array(32).fill(0.25))
  src.pushData(new Float32Array(BLOCK_SIZE - 32).fill(-0.25))

  ctx._state = 'running'
  let out = src._tick().getChannelData(0)
  almost(out[0], 0.25, 1e-6, 'first chunk starts quantum')
  almost(out[31], 0.25, 1e-6, 'first chunk ends at its length')
  almost(out[32], -0.25, 1e-6, 'second chunk continues in same quantum')
  almost(out[BLOCK_SIZE - 1], -0.25, 1e-6, 'second chunk fills quantum')
})
