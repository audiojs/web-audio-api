import test from 'tst'
import { is, ok } from 'tst'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from '../src/constants.js'
import GainNode from '../src/GainNode.js'
import AudioNode from '../src/AudioNode.js'
import { allAlmost } from './helpers.js'

test.mute('GainNode > applies gain to input', () => {
  let ctx = { sampleRate: 44100, currentTime: 0 }
  let gain = new GainNode(ctx)
  let src = new AudioNode(ctx, 0, 1)
  src.connect(gain)
  src._tick = () => AudioBuffer.filledWithVal(1, 2, BLOCK_SIZE, 44100)

  // gain=1: output=1
  ctx.currentTime++
  let block = gain._tick()
  is(block.numberOfChannels, 2)
  is(block.length, BLOCK_SIZE)
  allAlmost(block.getChannelData(0), 1)
  allAlmost(block.getChannelData(1), 1)

  // gain=0.2: output=0.2
  ctx.currentTime++
  gain.gain.value = 0.2
  block = gain._tick()
  allAlmost(block.getChannelData(0), 0.2)
  allAlmost(block.getChannelData(1), 0.2)

  // different input + gain=0.3: output=0.15
  ctx.currentTime++
  src._tick = () => AudioBuffer.filledWithVal(0.5, 3, BLOCK_SIZE, 44100)
  gain.gain.value = 0.3
  block = gain._tick()
  is(block.numberOfChannels, 3)
  allAlmost(block.getChannelData(0), 0.15)
  allAlmost(block.getChannelData(1), 0.15)
  allAlmost(block.getChannelData(2), 0.15)
})

// --- Phase 0 ---

test('Phase0 > GainNode > reuses output buffer across ticks', () => {
  let ctx = { sampleRate: 44100, currentTime: 0 }
  let gain = new GainNode(ctx)
  let src = new AudioNode(ctx, 0, 1)
  src.connect(gain)
  src._tick = () => AudioBuffer.filledWithVal(1, 1, BLOCK_SIZE, 44100)

  ctx.currentTime = 1
  let b1 = gain._tick()
  ctx.currentTime = 2
  let b2 = gain._tick()
  ok(b1 === b2, 'same buffer reused across ticks')
})
