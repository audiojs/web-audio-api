import test from 'tst'
import { is, ok, almost } from 'tst'
import AudioContext from '../src/AudioContext.js'
import AudioNode from '../src/AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { fill } from 'audio-buffer/util'
import { MediaStreamAudioSourceNode, MediaStreamAudioDestinationNode } from '../src/MediaStreamAudioSourceNode.js'
import { MediaStream, CustomMediaStreamTrack } from '../src/MediaStream.js'
import { BLOCK_SIZE } from '../src/constants.js'

let mkCtx = () => new AudioContext()

let mkStream = (settings) => {
  let track = new CustomMediaStreamTrack({ kind: 'audio', settings })
  return new MediaStream([track])
}

test('MediaStreamAudioSourceNode > outputs pushed data', () => {
  let ctx = mkCtx()
  let stream = mkStream({ channelCount: 1 })
  let node = new MediaStreamAudioSourceNode(ctx, { mediaStream: stream })

  let data = new Float32Array(BLOCK_SIZE)
  data.fill(0.6)
  stream.getAudioTracks()[0].pushData(data)

  ctx._state = 'running'
  let buf = node._tick()
  is(buf.numberOfChannels, 1)
  almost(buf.getChannelData(0)[0], 0.6, 1e-6, 'outputs pushed data')
})

test('MediaStreamAudioSourceNode > outputs silence when no data', () => {
  let ctx = mkCtx()
  let stream = mkStream({ channelCount: 1 })
  let node = new MediaStreamAudioSourceNode(ctx, { mediaStream: stream })

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
  let stream = mkStream({ channelCount: 1 })
  let src = new MediaStreamAudioSourceNode(ctx, { mediaStream: stream })
  let pcm = Buffer.alloc(BLOCK_SIZE * 2)
  for (let i = 0; i < BLOCK_SIZE; i++) pcm.writeInt16LE(Math.round(0.5 * 32767), i * 2)
  stream.getAudioTracks()[0].pushData(pcm, { channels: 1, bitDepth: 16 })

  ctx._state = 'running'
  let out = src._tick()
  almost(out.getChannelData(0)[0], 0.5, 1e-4, 'Int16 PCM decoded to [-1,1]')
  almost(out.getChannelData(0)[BLOCK_SIZE - 1], 0.5, 1e-4, 'last sample preserved')
})

test('MediaStreamAudioSourceNode > pushData deinterleaves stereo PCM buffer', () => {
  let ctx = mkCtx()
  let stream = mkStream({ channelCount: 2 })
  let src = new MediaStreamAudioSourceNode(ctx, { mediaStream: stream })
  let pcm = Buffer.alloc(BLOCK_SIZE * 2 * 2)
  for (let i = 0; i < BLOCK_SIZE; i++) {
    pcm.writeInt16LE(Math.round(0.3 * 32767), (i * 2) * 2)
    pcm.writeInt16LE(Math.round(-0.4 * 32767), (i * 2 + 1) * 2)
  }
  stream.getAudioTracks()[0].pushData(pcm, { channels: 2, bitDepth: 16 })

  ctx._state = 'running'
  let out = src._tick()
  is(out.numberOfChannels, 2, 'stereo output')
  almost(out.getChannelData(0)[0], 0.3, 1e-4, 'left channel preserved')
  almost(out.getChannelData(1)[0], -0.4, 1e-4, 'right channel preserved')
})

test('MediaStreamAudioSourceNode > queued chunks drain in order', () => {
  let ctx = mkCtx()
  let stream = mkStream({ channelCount: 1 })
  let src = new MediaStreamAudioSourceNode(ctx, { mediaStream: stream })
  let values = [0.1, 0.2, 0.3]
  for (let v of values) stream.getAudioTracks()[0].pushData(new Float32Array(BLOCK_SIZE).fill(v))

  ctx._state = 'running'
  for (let v of values) {
    let out = src._tick()
    almost(out.getChannelData(0)[0], v, 1e-6, `chunk ${v} drained in order`)
  }
  is(src._tick().getChannelData(0)[0], 0, 'silence after reader EOF')
})

test('MediaStreamAudioSourceNode > short chunks fill the same quantum', () => {
  let ctx = mkCtx()
  let stream = mkStream({ channelCount: 1 })
  let src = new MediaStreamAudioSourceNode(ctx, { mediaStream: stream })
  stream.getAudioTracks()[0].pushData(new Float32Array(32).fill(0.25))
  stream.getAudioTracks()[0].pushData(new Float32Array(BLOCK_SIZE - 32).fill(-0.25))

  ctx._state = 'running'
  let out = src._tick().getChannelData(0)
  almost(out[0], 0.25, 1e-6, 'first chunk starts quantum')
  almost(out[31], 0.25, 1e-6, 'first chunk ends at its length')
  almost(out[32], -0.25, 1e-6, 'second chunk continues in same quantum')
  almost(out[BLOCK_SIZE - 1], -0.25, 1e-6, 'second chunk fills quantum')
})

test('MediaStreamAudioSourceNode > pushData() compat: works without MediaStream', () => {
  let ctx = mkCtx()
  let src = new MediaStreamAudioSourceNode(ctx, { numberOfChannels: 1 })
  src.pushData(new Float32Array(BLOCK_SIZE).fill(0.5))

  ctx._state = 'running'
  let out = src._tick()
  almost(out.getChannelData(0)[0], 0.5, 1e-6, 'legacy pushData() still works')
})

test('MediaStreamAudioSourceNode > pushData() compat: uses constructor bitDepth for raw PCM when call options are omitted', () => {
  let ctx = mkCtx()
  let src = new MediaStreamAudioSourceNode(ctx, { numberOfChannels: 1, bitDepth: 16 })
  let samples = new Int16Array(BLOCK_SIZE)
  samples[0] = 32767
  samples[1] = -32768
  samples[2] = 16384
  src.pushData(samples)

  ctx._state = 'running'
  let out = src._tick().getChannelData(0)
  almost(out[0], 32767 / 32768, 1e-6, 'decodes positive 16-bit PCM using constructor bitDepth')
  almost(out[1], -1, 1e-6, 'decodes negative 16-bit PCM using constructor bitDepth')
  almost(out[2], 0.5, 1e-6, 'decodes mid-scale 16-bit PCM using constructor bitDepth')
})

test('MediaStreamAudioDestinationNode > stops capturing after track.stop()', () => {
  let ctx = mkCtx()
  let dest = new MediaStreamAudioDestinationNode(ctx, { numberOfChannels: 1 })
  let src = new AudioNode(ctx, 0, 1)
  src.connect(dest)
  src._tick = () => { let b = new AudioBuffer(1, BLOCK_SIZE, 44100); b.getChannelData(0).fill(0.7); return b }

  ctx._state = 'running'
  dest._tick()
  ok(dest.stream.readable, 'has data before stop')

  // drain the queue then stop the track
  while (dest.stream.readable) dest.stream.read()
  dest.stream.getAudioTracks()[0].stop()
  dest._tick()
  ok(!dest.stream.readable, 'no new data after track.stop()')
})

test('CustomMediaStreamTrack > clone fan-out: clone receives future chunks', () => {
  let track = new CustomMediaStreamTrack({})
  let clone = track.clone()

  track.pushData(new Float32Array(BLOCK_SIZE).fill(0.3))
  is(clone._buffers.length, 1, 'clone receives pushed chunk')
  almost(clone._buffers[0][0], 0.3, 1e-6, 'clone chunk has correct data')
})

test('CustomMediaStreamTrack > clone fan-out: stop() unsubscribes clone', () => {
  let track = new CustomMediaStreamTrack({})
  let clone = track.clone()
  clone.stop()

  track.pushData(new Float32Array(BLOCK_SIZE).fill(0.3))
  is(clone._buffers.length, 0, 'stopped clone no longer receives data')
})

test('MediaStream > addTrack / removeTrack fire events with event.track', () => {
  let stream = new MediaStream()
  let track = new CustomMediaStreamTrack({ kind: 'audio' })

  let added = null, removed = null
  stream.addEventListener('addtrack', e => { added = e.track })
  stream.addEventListener('removetrack', e => { removed = e.track })

  stream.addTrack(track)
  ok(added === track, 'addtrack event fired with correct track')

  stream.removeTrack(track)
  ok(removed === track, 'removetrack event fired with correct track')
})
