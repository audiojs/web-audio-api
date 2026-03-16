import test from 'tst'
import { is, ok, throws } from 'tst'
import AudioBuffer from 'audio-buffer'
import AudioBufferSourceNode from '../src/AudioBufferSourceNode.js'
import { BLOCK_SIZE } from '../src/constants.js'
import { allEqual, allAlmost } from './helpers.js'

let mkCtx = () => ({ sampleRate: 44100, currentTime: 0, BLOCK_SIZE })

// test buffer: 4 full blocks + 64 samples, 2 channels
// ch0: 0.1×128, 0.2×128, 0.3×128, 0.4×128, 0.5×64
// ch1: -0.1×128, -0.2×128, -0.3×128, -0.4×128, -0.5×64
let getTestBuffer = () => {
  let buf = new AudioBuffer(2, 128 * 4 + 64, 44100)
  for (let i = 0; i < 4; i++) {
    let ch0 = buf.getChannelData(0), ch1 = buf.getChannelData(1)
    for (let j = 0; j < 128; j++) {
      ch0[i * 128 + j] = (i + 1) * 0.1
      ch1[i * 128 + j] = (i + 1) * -0.1
    }
  }
  let ch0 = buf.getChannelData(0), ch1 = buf.getChannelData(1)
  for (let j = 0; j < 64; j++) {
    ch0[4 * 128 + j] = 0.5
    ch1[4 * 128 + j] = -0.5
  }
  return buf
}

test('AudioBufferSourceNode > outputs zeros when not started', () => {
  let ctx = mkCtx()
  let node = new AudioBufferSourceNode(ctx)

  for (let t = 0; t < 3; t++) {
    ctx.currentTime = t
    let block = node._tick()
    is(block.length, 128)
    is(block.numberOfChannels, 1)
    allEqual(block.getChannelData(0), 0)
  }
})

test('AudioBufferSourceNode > plays buffer and fires onended', () => {
  let ctx = mkCtx()
  let node = new AudioBufferSourceNode(ctx)
  let buf = getTestBuffer()
  let ended = false

  node.buffer = buf
  node.start(1)
  node.onended = () => { ended = true }

  let blocks = []
  while (ctx.currentTime < 7) {
    ok(!ended, 'onended not yet')
    blocks.push(node._tick())
    ctx.currentTime += 1
  }
  ok(ended, 'onended fired')

  // block 0: before start → zeros
  is(blocks[0].numberOfChannels, 1)
  allEqual(blocks[0].getChannelData(0), 0)

  // blocks 1-4: sequential buffer data
  allAlmost(blocks[1].getChannelData(0), 0.1)
  allAlmost(blocks[1].getChannelData(1), -0.1)
  allAlmost(blocks[2].getChannelData(0), 0.2)
  allAlmost(blocks[3].getChannelData(0), 0.3)
  allAlmost(blocks[4].getChannelData(0), 0.4)

  // block 5: partial (64 samples + 64 zeros)
  allAlmost(blocks[5].getChannelData(0).subarray(0, 63), 0.5)
  allAlmost(blocks[5].getChannelData(0).subarray(64, 128), 0)

  // after playback: disposed
  throws(() => node._tick())
})

test('AudioBufferSourceNode > loops buffer', () => {
  let ctx = mkCtx()
  let node = new AudioBufferSourceNode(ctx)
  node.buffer = getTestBuffer()
  node.loop = true
  node.start(0)

  let blocks = []
  for (let i = 0; i < 7; i++) {
    ctx.currentTime += 1
    blocks.push(node._tick())
  }

  // full blocks
  allAlmost(blocks[0].getChannelData(0), 0.1)
  allAlmost(blocks[1].getChannelData(0), 0.2)
  allAlmost(blocks[2].getChannelData(0), 0.3)
  allAlmost(blocks[3].getChannelData(0), 0.4)

  // partial + loop restart
  allAlmost(blocks[4].getChannelData(0).subarray(0, 63), 0.5)
  allAlmost(blocks[4].getChannelData(0).subarray(64, 128), 0.1)
})

test('AudioBufferSourceNode > stop cancels playback', () => {
  let ctx = mkCtx()
  let node = new AudioBufferSourceNode(ctx)
  node.buffer = getTestBuffer()
  node.loop = true
  node.start(0)
  node.stop(1)

  let block = node._tick()
  allAlmost(block.getChannelData(0), 0.1)

  ctx.currentTime += 1
  block = node._tick()
  is(block.numberOfChannels, 1)
  allEqual(block.getChannelData(0), 0)
})

// --- Phase 0 ---

test('Phase0 > AudioBufferSourceNode > DSP state is instance fields (not closure)', () => {
  let ctx = mkCtx()
  let node = new AudioBufferSourceNode(ctx)
  node.buffer = getTestBuffer()

  // Playback state is on instance, not captured in closure
  ok('_cursor' in node, 'cursor is instance field')
  ok('_playing' in node, 'playing is instance field')
  is(node._playing, false)

  node.start(0)
  ctx.currentTime = 0
  node._tick()
  is(node._playing, true)
  ok(node._cursor > 0, 'cursor advanced')
})
