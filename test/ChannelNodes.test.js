import test from 'tst'
import { is, ok, almost } from 'tst'
import AudioNode from '../src/AudioNode.js'
import AudioBuffer from 'audio-buffer'
import ChannelSplitterNode from '../src/ChannelSplitterNode.js'
import ChannelMergerNode from '../src/ChannelMergerNode.js'
import { BLOCK_SIZE } from '../src/constants.js'

let SR = 44100
let wire = (c, node, buf) => { let s = new AudioNode(c, 0, 1); s.connect(node); s._tick = () => buf; return s }

test('ChannelSplitterNode > defaults', () => {
  let node = new ChannelSplitterNode({ sampleRate: SR, currentTime: 0 })
  is(node.numberOfInputs, 1); is(node.numberOfOutputs, 6)
})

test.mute('ChannelSplitterNode > splits stereo to mono', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new ChannelSplitterNode(c, { numberOfOutputs: 2 })
  let stereo = new AudioBuffer(2, BLOCK_SIZE, SR)
  stereo.getChannelData(0).fill(0.3); stereo.getChannelData(1).fill(0.7)
  wire(c, node, stereo)
  c.currentTime = 1
  let ch0 = node._tickOutput(0), ch1 = node._tickOutput(1)
  is(ch0.numberOfChannels, 1); is(ch1.numberOfChannels, 1)
  almost(ch0.getChannelData(0)[0], 0.3, 1e-6, 'L'); almost(ch1.getChannelData(0)[0], 0.7, 1e-6, 'R')
})

test('ChannelMergerNode > defaults', () => {
  let node = new ChannelMergerNode({ sampleRate: SR, currentTime: 0 })
  is(node.numberOfInputs, 6); is(node.numberOfOutputs, 1)
})

test.mute('ChannelMergerNode > merges mono to stereo', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new ChannelMergerNode(c, { numberOfInputs: 2 })
  let s0 = new AudioNode(c, 0, 1), s1 = new AudioNode(c, 0, 1)
  s0.connect(node, 0, 0); s1.connect(node, 0, 1)
  s0._tick = () => AudioBuffer.filledWithVal(0.2, 1, BLOCK_SIZE, SR)
  s1._tick = () => AudioBuffer.filledWithVal(0.8, 1, BLOCK_SIZE, SR)
  c.currentTime = 1; let buf = node._tick()
  is(buf.numberOfChannels, 2)
  almost(buf.getChannelData(0)[0], 0.2, 1e-6, 'ch0'); almost(buf.getChannelData(1)[0], 0.8, 1e-6, 'ch1')
})
