import test from 'tst'
import { is, ok, throws, almost } from 'tst'
import OscillatorNode from '../src/OscillatorNode.js'
import PeriodicWave from '../src/PeriodicWave.js'
import { BLOCK_SIZE } from '../src/constants.js'

let SR = 44100

test('OscillatorNode > constructor defaults', () => {
  let node = new OscillatorNode({ sampleRate: SR, currentTime: 0 })
  is(node.type, 'sine')
  is(node.frequency.value, 440)
  is(node.detune.value, 0)
})

test('OscillatorNode > type validation', () => {
  let node = new OscillatorNode({ sampleRate: SR, currentTime: 0 })
  node.type = 'square'; is(node.type, 'square')
  node.type = 'invalid'; is(node.type, 'square') // WebIDL: silently ignored
  throws(() => { node.type = 'custom' }) // InvalidStateError
})

test('OscillatorNode > setPeriodicWave', () => {
  let node = new OscillatorNode({ sampleRate: SR, currentTime: 0 })
  node.setPeriodicWave(new PeriodicWave(new Float32Array([0, 0]), new Float32Array([0, 1])))
  is(node.type, 'custom')
})

test.mute('OscillatorNode > sine peaks at ±1', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let osc = new OscillatorNode(c)
  osc.frequency.value = 100
  osc.start(0); c.currentTime = 0; osc._tick()
  let max = -Infinity, min = Infinity
  for (let b = 0; b < 10; b++) {
    c.currentTime = b + 1
    let d = osc._tick().getChannelData(0)
    for (let i = 0; i < BLOCK_SIZE; i++) { max = Math.max(max, d[i]); min = Math.min(min, d[i]) }
  }
  almost(max, 1, 0.05, 'peak near +1')
  almost(min, -1, 0.05, 'trough near -1')
})

test.mute('OscillatorNode > square has flat plateaus', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let osc = new OscillatorNode(c)
  osc.type = 'square'; osc.frequency.value = 100
  osc.start(0); c.currentTime = 0; osc._tick()
  let pos = 0, neg = 0
  for (let b = 0; b < 10; b++) {
    c.currentTime = b + 1
    let d = osc._tick().getChannelData(0)
    for (let i = 0; i < BLOCK_SIZE; i++) { if (d[i] > 0.5) pos++; if (d[i] < -0.5) neg++ }
  }
  ok(pos > 100, 'positive plateaus'); ok(neg > 100, 'negative plateaus')
})

test.mute('OscillatorNode > detune shifts frequency by octave', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let osc = new OscillatorNode(c)
  osc.frequency.value = 440; osc.detune.value = 1200
  osc.start(0); c.currentTime = 0; osc._tick()
  let crossings = 0
  for (let b = 0; b < 5; b++) {
    c.currentTime = b + 1; let d = osc._tick().getChannelData(0)
    for (let i = 1; i < BLOCK_SIZE; i++) if (d[i - 1] * d[i] < 0) crossings++
  }
  ok(crossings > 15, `880Hz crossings: ${crossings}`)
})

test('OscillatorNode > onended fires after stop', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let osc = new OscillatorNode(c)
  let ended = false
  osc.onended = () => { ended = true }
  osc.start(0); osc.stop(0)
  c.currentTime = 0; osc._tick(); osc._tick()
  ok(ended, 'onended fired')
})

test('PeriodicWave > built-in waveforms', () => {
  for (let type of ['sine', 'square', 'sawtooth', 'triangle']) {
    let table = PeriodicWave.getBuiltIn(type)
    ok(table.length === 4096, type + ' has 4096 samples')
    ok(table.some(v => v !== 0), type + ' non-silent')
  }
})

test('PeriodicWave > sine normalized to [-1, 1]', () => {
  let table = PeriodicWave.getBuiltIn('sine')
  let max = 0
  for (let i = 0; i < table.length; i++) max = Math.max(max, Math.abs(table[i]))
  almost(max, 1, 0.01)
})
