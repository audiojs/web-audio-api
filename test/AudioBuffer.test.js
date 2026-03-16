import test from 'tst'
import { is, ok, throws, almost } from 'tst'
import AudioBuffer from 'audio-buffer'

test('AudioBuffer > constructor', () => {
  let buf = new AudioBuffer(3, 100, 44100)
  is(buf.numberOfChannels, 3)
  is(buf.length, 100)
  is(buf.sampleRate, 44100)
  almost(buf.duration, 100 / 44100, 1e-10)
})

test('AudioBuffer > constructor > validates params', () => {
  throws(() => new AudioBuffer(0, 100, 44100))
  throws(() => new AudioBuffer(3, -1, 44100))
  throws(() => new AudioBuffer(3, 100, 0))
})

test('AudioBuffer > getChannelData', () => {
  let buf = new AudioBuffer(3, 100, 44100)
  let ch0 = buf.getChannelData(0)
  ok(ch0 instanceof Float32Array)
  is(ch0.length, 100)
  throws(() => buf.getChannelData(3))
})

test('AudioBuffer > getChannelData returns view (not copy)', () => {
  let buf = new AudioBuffer(1, 10, 44100)
  let ch = buf.getChannelData(0)
  ch[0] = 0.5
  is(buf.getChannelData(0)[0], 0.5)
})

test('AudioBuffer > filledWithVal', () => {
  let buf = AudioBuffer.filledWithVal(0.7, 2, 50, 44100)
  is(buf.numberOfChannels, 2)
  is(buf.length, 50)
  for (let i = 0; i < 50; i++) {
    almost(buf.getChannelData(0)[i], 0.7, 1e-6)
    almost(buf.getChannelData(1)[i], 0.7, 1e-6)
  }
})

test('AudioBuffer > fromArray', () => {
  let arr = [new Float32Array([1, 2, 3]), new Float32Array([4, 5, 6])]
  let buf = AudioBuffer.fromArray(arr, 44100)
  is(buf.numberOfChannels, 2)
  is(buf.length, 3)
  is(buf.getChannelData(0)[0], 1)
  is(buf.getChannelData(1)[2], 6)
})

test('AudioBuffer > slice', () => {
  let arr = [new Float32Array([1, 2, 3, 4, 5])]
  let buf = AudioBuffer.fromArray(arr, 44100)
  let sliced = buf.slice(1, 3)
  is(sliced.length, 2)
  is(sliced.getChannelData(0)[0], 2)
  is(sliced.getChannelData(0)[1], 3)
})

test('AudioBuffer > concat', () => {
  let a = AudioBuffer.fromArray([new Float32Array([1, 2])], 44100)
  let b = AudioBuffer.fromArray([new Float32Array([3, 4])], 44100)
  let c = a.concat(b)
  is(c.length, 4)
  is(c.getChannelData(0)[2], 3)
})

test('AudioBuffer > concat > rejects mismatched sampleRate', () => {
  let a = new AudioBuffer(1, 10, 44100)
  let b = new AudioBuffer(1, 10, 22050)
  throws(() => a.concat(b))
})

test('AudioBuffer > set', () => {
  let a = new AudioBuffer(1, 10, 44100)
  let b = AudioBuffer.fromArray([new Float32Array([0.5, 0.6])], 44100)
  a.set(b, 3)
  almost(a.getChannelData(0)[3], 0.5, 1e-6)
  almost(a.getChannelData(0)[4], 0.6, 1e-6)
})
