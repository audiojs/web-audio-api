import test from 'tst'
import { is, ok, throws, almost } from 'tst'
import AudioNode from '../src/AudioNode.js'
import AudioBuffer from 'audio-buffer'
import BiquadFilterNode from '../src/BiquadFilterNode.js'
import { BLOCK_SIZE } from '../src/constants.js'

let SR = 44100
let wire = (c, node, buf) => { let s = new AudioNode(c, 0, 1); s.connect(node); s._tick = () => buf; return s }

test('BiquadFilterNode > defaults', () => {
  let f = new BiquadFilterNode({ sampleRate: SR, currentTime: 0 })
  is(f.type, 'lowpass'); is(f.frequency.value, 350); is(f.Q.value, 1); is(f.gain.value, 0)
})

test('BiquadFilterNode > type validation', () => {
  let f = new BiquadFilterNode({ sampleRate: SR, currentTime: 0 })
  f.type = 'highpass'; is(f.type, 'highpass')
  f.type = 'invalid'; is(f.type, 'highpass') // WebIDL: silently ignored
})

test.mute('BiquadFilterNode > lowpass passes DC', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let f = new BiquadFilterNode(c); f.type = 'lowpass'; f.frequency.value = 1000
  wire(c, f, AudioBuffer.filledWithVal(0.5, 1, BLOCK_SIZE, SR))
  for (let i = 0; i < 20; i++) { c.currentTime = i; f._tick() }
  c.currentTime = 20; let buf = f._tick()
  almost(buf.getChannelData(0)[BLOCK_SIZE - 1], 0.5, 0.05, 'DC passes')
})

test.mute('BiquadFilterNode > highpass blocks DC', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let f = new BiquadFilterNode(c); f.type = 'highpass'; f.frequency.value = 1000
  wire(c, f, AudioBuffer.filledWithVal(0.5, 1, BLOCK_SIZE, SR))
  for (let i = 0; i < 20; i++) { c.currentTime = i; f._tick() }
  c.currentTime = 20; let buf = f._tick()
  almost(buf.getChannelData(0)[BLOCK_SIZE - 1], 0, 0.05, 'DC blocked')
})

test('BiquadFilterNode > per-type frequency response shape', () => {
  let c = { sampleRate: SR, currentTime: 0 }
  let freqs = new Float32Array([50, 350, 5000])
  let mag = new Float32Array(3), phase = new Float32Array(3)

  let lp = new BiquadFilterNode(c); lp.type = 'lowpass'; lp.frequency.value = 350
  lp.getFrequencyResponse(freqs, mag, phase)
  ok(mag[0] > mag[2], 'lowpass: 50Hz > 5kHz')

  let hp = new BiquadFilterNode(c); hp.type = 'highpass'; hp.frequency.value = 350
  hp.getFrequencyResponse(freqs, mag, phase)
  ok(mag[2] > mag[0], 'highpass: 5kHz > 50Hz')

  let bp = new BiquadFilterNode(c); bp.type = 'bandpass'; bp.frequency.value = 350
  bp.getFrequencyResponse(freqs, mag, phase)
  ok(mag[1] > mag[0] && mag[1] > mag[2], 'bandpass: center > edges')

  let notch = new BiquadFilterNode(c); notch.type = 'notch'; notch.frequency.value = 350
  notch.getFrequencyResponse(freqs, mag, phase)
  ok(mag[1] < mag[0] && mag[1] < mag[2], 'notch: center < edges')

  let ap = new BiquadFilterNode(c); ap.type = 'allpass'; ap.frequency.value = 350
  ap.getFrequencyResponse(freqs, mag, phase)
  for (let i = 0; i < 3; i++) almost(mag[i], 1, 0.01, 'allpass: mag ≈ 1')

  let pk = new BiquadFilterNode(c); pk.type = 'peaking'; pk.frequency.value = 350; pk.gain.value = 12
  pk.getFrequencyResponse(freqs, mag, phase)
  ok(mag[1] > mag[0] && mag[1] > mag[2], 'peaking: center boosted')
})
