import test from 'tst'
import { is, ok, throws } from 'tst'
import ScriptProcessorNode from '../src/ScriptProcessorNode.js'
import { BLOCK_SIZE } from '../src/constants.js'
import { allEqual } from './helpers.js'

let mkCtx = () => ({ sampleRate: 44100, currentTime: 0 })

test('ScriptProcessorNode > rejects invalid bufferSize', () => {
  throws(() => new ScriptProcessorNode(mkCtx(), 100, 1, 1))
  throws(() => new ScriptProcessorNode(mkCtx(), 3, 1, 1))
})

test('ScriptProcessorNode > accepts valid bufferSizes', () => {
  for (let size of [256, 512, 1024, 2048, 4096, 8192, 16384]) {
    let node = new ScriptProcessorNode(mkCtx(), size, 1, 1)
    is(node.bufferSize, size)
  }
})

test('ScriptProcessorNode > onaudioprocess fires with correct event', () => {
  let ctx = mkCtx()
  let node = new ScriptProcessorNode(ctx, 256, 1, 1)
  let events = []

  node.onaudioprocess = (e) => {
    events.push(e)
    // fill output with constant
    let out = e.outputBuffer.getChannelData(0)
    for (let i = 0; i < out.length; i++) out[i] = 0.5
  }

  // Need 256/128 = 2 ticks to fill bufferSize
  ctx.currentTime = 1
  node._tick()
  is(events.length, 0)

  ctx.currentTime = 2
  node._tick()
  is(events.length, 1)
  is(events[0].inputBuffer.length, 256)
  is(events[0].outputBuffer.length, 256)
  ok(events[0].playbackTime !== undefined)
})

test.mute('ScriptProcessorNode > outputs zeros before onaudioprocess set', () => {
  let ctx = mkCtx()
  let node = new ScriptProcessorNode(ctx, 256, 1, 2)
  let block = node._tick()
  is(block.numberOfChannels, 2)
  is(block.length, BLOCK_SIZE)
  allEqual(block.getChannelData(0), 0)
})

// --- Phase 0 ---

test('Phase0 > ScriptProcessorNode > uses concat/slice (alloc storm)', () => {
  // Issue #13: concat() creates new AudioBuffers every tick
  // This documents the behavior exists
  let ctx = mkCtx()
  let node = new ScriptProcessorNode(ctx, 256, 1, 1)
  node.onaudioprocess = (e) => {
    let out = e.outputBuffer.getChannelData(0)
    for (let i = 0; i < out.length; i++) out[i] = 0.3
  }

  // Run 2 ticks to trigger process
  ctx.currentTime = 1
  node._tick()
  ctx.currentTime = 2
  let block = node._tick()

  // Should still produce correct output despite alloc overhead
  is(block.length, BLOCK_SIZE)
})
