import test from 'tst'
import { is, ok, throws, rejects } from 'tst'
import { readFileSync } from 'fs'
import { validateFormat, decodeAudioData, BufferEncoder } from '../src/utils.js'

test('validateFormat > applies defaults', () => {
  let fmt = validateFormat({ numberOfChannels: 2 })
  is(fmt.bitDepth, 16)
  is(fmt.endianness, 'LE')
  is(fmt.signed, true)
  is(fmt.numberOfChannels, 2)
})

test('validateFormat > rejects invalid bitDepth', () => {
  throws(() => validateFormat({ numberOfChannels: 2, bitDepth: 24 }))
  throws(() => validateFormat({ numberOfChannels: 2, bitDepth: 'x' }))
})

test('validateFormat > rejects missing numberOfChannels', () => {
  throws(() => validateFormat({}))
})

test('BufferEncoder > encodes float to PCM', () => {
  let encoder = BufferEncoder({ numberOfChannels: 1, bitDepth: 16 })
  let data = [new Float32Array([0.5, -0.5, 0, 1])]
  let result = encoder(data)
  ok(result.length === 8, 'correct byte length (4 samples * 2 bytes)')
})

// --- decodeAudioData (audio-decode) ---

test('decodeAudioData > decodes 16b mono wav (promise)', async () => {
  let buf = readFileSync(new URL('./sounds/steps-mono-16b-44khz.wav', import.meta.url))
  let ab = await decodeAudioData(buf)
  is(ab.numberOfChannels, 1)
  is(ab.sampleRate, 44100)
  ok(ab.length > 0, 'has samples')
})

test('decodeAudioData > decodes 16b stereo wav (promise)', async () => {
  let buf = readFileSync(new URL('./sounds/steps-stereo-16b-44khz.wav', import.meta.url))
  let ab = await decodeAudioData(buf)
  is(ab.numberOfChannels, 2)
  is(ab.sampleRate, 44100)
  is(ab.length, 21 * 4410)
})

test('decodeAudioData > decodes 16b stereo wav (callback)', async () => {
  let buf = readFileSync(new URL('./sounds/steps-stereo-16b-44khz.wav', import.meta.url))
  let result = await new Promise((resolve, reject) => {
    decodeAudioData(buf, (err, ab) => err ? reject(err) : resolve(ab))
  })
  is(result.numberOfChannels, 2)
  is(result.sampleRate, 44100)
})

test('decodeAudioData > decodes stereo mp3 (promise)', async () => {
  let buf = readFileSync(new URL('./sounds/steps-stereo-16b-44khz.mp3', import.meta.url))
  let ab = await decodeAudioData(buf)
  is(ab.numberOfChannels, 2)
  is(ab.sampleRate, 44100)
  ok(ab.length > 0, 'has samples')
})

test('decodeAudioData > rejects unrecognized format (promise)', async () => {
  let buf = readFileSync(new URL('./sounds/generateFile.pd', import.meta.url))
  await rejects(() => decodeAudioData(buf), undefined, 'should reject')
})

test('decodeAudioData > errors on unrecognized format (callback)', async () => {
  let buf = readFileSync(new URL('./sounds/generateFile.pd', import.meta.url))
  let err = await new Promise(resolve => {
    decodeAudioData(buf, (e) => resolve(e))
  })
  ok(err, 'got error')
})
