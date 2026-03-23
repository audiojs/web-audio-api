import test from 'tst'
import { ok, almost } from 'tst'
import AudioNode from '../src/AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { fill } from 'audio-buffer/util'
import ConvolverNode from '../src/ConvolverNode.js'
import { BLOCK_SIZE } from '../src/constants.js'

let SR = 44100
let wire = (c, node, buf) => { let s = new AudioNode(c, 0, 1); s.connect(node); s._tick = () => buf; return s }

test('ConvolverNode > passthrough when no buffer', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new ConvolverNode(c)
  wire(c, node, fill(new AudioBuffer(1, BLOCK_SIZE, SR), 0.5))
  c.currentTime = 1; almost(node._tick().getChannelData(0)[0], 0.5, 1e-6)
})

test.mute('ConvolverNode > unit impulse IR = passthrough', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new ConvolverNode(c)
  node.normalize = false
  let ir = new AudioBuffer(1, 1, SR); ir.getChannelData(0)[0] = 1
  node.buffer = ir
  wire(c, node, fill(new AudioBuffer(1, BLOCK_SIZE, SR), 0.7))
  c.currentTime = 1; almost(node._tick().getChannelData(0)[0], 0.7, 0.01, 'passthrough')
})

test.mute('ConvolverNode > delay IR shifts signal by 1 sample', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new ConvolverNode(c); node.normalize = false
  let ir = new AudioBuffer(1, 2, SR); ir.getChannelData(0)[1] = 1
  node.buffer = ir
  let impulse = new AudioBuffer(1, BLOCK_SIZE, SR); impulse.getChannelData(0)[0] = 1
  wire(c, node, impulse)
  c.currentTime = 1; let buf = node._tick()
  almost(buf.getChannelData(0)[0], 0, 0.01, 'sample 0 silent')
  almost(buf.getChannelData(0)[1], 1, 0.01, 'impulse at sample 1')
})
