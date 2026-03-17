import test from 'tst'
import { is, ok, almost } from 'tst'
import AudioNode from '../src/AudioNode.js'
import AudioBuffer from 'audio-buffer'
import StereoPannerNode from '../src/StereoPannerNode.js'
import { BLOCK_SIZE } from '../src/constants.js'

let SR = 44100
let wire = (c, node, buf) => { let s = new AudioNode(c, 0, 1); s.connect(node); s._tick = () => buf; return s }

test('StereoPannerNode > mono: full left/center/right', () => {
  for (let [p, expL, expR, label] of [
    [-1, 1, 0, 'full left'], [0, Math.cos(Math.PI/4), Math.sin(Math.PI/4), 'center'], [1, 0, 1, 'full right']
  ]) {
    let c = { sampleRate: SR, currentTime: 0 }
    let node = new StereoPannerNode(c)
    node.pan.value = p
    wire(c, node, AudioBuffer.filledWithVal(1, 1, BLOCK_SIZE, SR))
    c.currentTime = 1; let buf = node._tick()
    almost(buf.getChannelData(0)[0], expL, 0.01, label + ' L')
    almost(buf.getChannelData(1)[0], expR, 0.01, label + ' R')
  }
})

test('StereoPannerNode > stereo: center is passthrough', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let node = new StereoPannerNode(c)
  let stereo = new AudioBuffer(2, BLOCK_SIZE, SR)
  stereo.getChannelData(0).fill(0.6); stereo.getChannelData(1).fill(0.4)
  wire(c, node, stereo)
  c.currentTime = 1; let buf = node._tick()
  almost(buf.getChannelData(0)[0], 0.6, 0.01, 'L passthrough')
  almost(buf.getChannelData(1)[0], 0.4, 0.01, 'R passthrough')
})

test.mute('StereoPannerNode > stereo: continuous across pan=0', () => {
  // verify no discontinuity at p=0 by checking p=-0.01 and p=+0.01 produce similar output
  let stereo = new AudioBuffer(2, BLOCK_SIZE, 44100)
  stereo.getChannelData(0).fill(0.6); stereo.getChannelData(1).fill(0.4)
  let results = []
  for (let p of [-0.01, 0, 0.01]) {
    let c = { sampleRate: SR, currentTime: 0 }
    let node = new StereoPannerNode(c)
    node.pan.value = p
    wire(c, node, stereo)
    c.currentTime = 1; let buf = node._tick()
    results.push([buf.getChannelData(0)[0], buf.getChannelData(1)[0]])
  }
  // difference between p=-0.01 and p=+0.01 should be tiny
  almost(results[0][0], results[2][0], 0.05, 'L continuous across 0')
  almost(results[0][1], results[2][1], 0.05, 'R continuous across 0')
})
