import test from 'tst'
import { is, ok, rejects } from 'tst'
import { readFileSync } from 'node:fs'
import { decodeAudioData } from '../src/utils.js'

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
  try {
    let ab = await decodeAudioData(buf)
    is(ab.numberOfChannels, 2)
    is(ab.sampleRate, 44100)
    ok(ab.length > 0, 'has samples')
  } catch (e) {
    // audio-decode's WASM loader (simple-yenc) has CRC issues in Bun
    if (typeof Bun !== 'undefined' && e.message?.includes('crc32')) ok(true, 'skip: Bun CRC issue in audio-decode dependency')
    else throw e
  }
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
