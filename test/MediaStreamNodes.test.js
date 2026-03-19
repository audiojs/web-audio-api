import test from 'tst'
import { is, ok, almost } from 'tst'
import AudioContext from '../src/AudioContext.js'
import AudioNode from '../src/AudioNode.js'
import AudioBuffer from 'audio-buffer'
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
  src._tick = () => AudioBuffer.filledWithVal(0.7, 1, BLOCK_SIZE, 44100)

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
