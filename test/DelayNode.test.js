import test from 'tst'
import { ok, almost, throws } from 'tst'
import AudioNode from '../src/AudioNode.js'
import AudioBuffer from 'audio-buffer'
import DelayNode from '../src/DelayNode.js'
import { BLOCK_SIZE } from '../src/constants.js'

let SR = 44100
let wire = (c, node, buf) => { let s = new AudioNode(c, 0, 1); s.connect(node); s._tick = () => buf; return s }

test.mute('DelayNode > zero delay passthrough', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new DelayNode(c)
  node.delayTime.value = 0
  wire(c, node, AudioBuffer.filledWithVal(0.7, 1, BLOCK_SIZE, SR))
  c.currentTime = 1; let buf = node._tick()
  almost(buf.getChannelData(0)[0], 0.7, 0.01, 'passthrough')
})

test.mute('DelayNode > 1-block delay', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new DelayNode(c, { maxDelayTime: 1 })
  node.delayTime.value = BLOCK_SIZE / SR
  let impulse = new AudioBuffer(1, BLOCK_SIZE, SR)
  impulse.getChannelData(0)[0] = 1.0
  let silent = new AudioBuffer(1, BLOCK_SIZE, SR)
  let call = 0
  let src = wire(c, node, impulse)
  src._tick = () => ++call === 1 ? impulse : silent
  c.currentTime = 1; let b1 = node._tick()
  almost(b1.getChannelData(0)[0], 0, 0.01, 'block 1 silent')
  c.currentTime = 2; let b2 = node._tick()
  ok(Math.abs(b2.getChannelData(0)[0]) > 0.5, 'impulse in block 2')
})

test('DelayNode > rejects invalid maxDelayTime', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  throws(() => new DelayNode(c, { maxDelayTime: -1 }))
  throws(() => new DelayNode(c, { maxDelayTime: Infinity }))
  throws(() => new DelayNode(c, { maxDelayTime: NaN }))
  throws(() => new DelayNode(c, { maxDelayTime: 200 }))
})
