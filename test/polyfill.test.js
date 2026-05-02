import test from 'tst'
import { is, ok } from 'tst'
import '../polyfill.js'

test('polyfill > Web Audio + MediaStream globals', () => {
  ok(typeof globalThis.AudioContext === 'function')
  ok(typeof globalThis.MediaStream === 'function')
  ok(typeof globalThis.MediaStreamTrack === 'function')
  ok(typeof globalThis.CustomMediaStreamTrack === 'function')
})

test('polyfill > MediaStreamTrack lifecycle', () => {
  let t = new MediaStreamTrack('audio', 'Mic')
  is(t.kind, 'audio'); is(t.label, 'Mic'); is(t.readyState, 'live')
  t.stop(); is(t.readyState, 'ended')
  ok(t.clone() instanceof MediaStreamTrack)
})

test('polyfill > CustomMediaStreamTrack pushData', () => {
  let t = new CustomMediaStreamTrack({ kind: 'audio', label: 'Mic', settings: { channelCount: 1 } })
  is(t.kind, 'audio'); is(t.label, 'Mic'); is(t.readyState, 'live')
  t.pushData(new Float32Array(128).fill(0.5))
  is(t._buffers.length, 1)
  ok(t.clone() instanceof CustomMediaStreamTrack)
})

test('polyfill > MediaStream aggregates tracks', () => {
  let a = new MediaStreamTrack('audio')
  let s = new MediaStream([a])
  is(s.getAudioTracks().length, 1)
  is(s.getVideoTracks().length, 0)
  ok(s.active)
  a.stop()
  ok(!s.active)
})

test('polyfill > createMediaStreamSource accepts polyfill MediaStream', () => {
  let ctx = new AudioContext()
  let s = new MediaStream([new CustomMediaStreamTrack({ kind: 'audio' })])
  let node = ctx.createMediaStreamSource(s)
  is(node.mediaStream, s)
})

test('polyfill > navigator.mediaDevices.getUserMedia acquires or meaningfully rejects microphone streams', async () => {
  ok(typeof globalThis.navigator.mediaDevices.getUserMedia === 'function',
    'getUserMedia installed on mediaDevices')

  let result = globalThis.navigator.mediaDevices.getUserMedia({ audio: true })
  ok(result && typeof result.then === 'function',
    'getUserMedia returns a promise')

  try {
    let stream = await result
    ok(stream instanceof MediaStream, 'resolved value is a MediaStream')
    ok(stream.getAudioTracks().length > 0,
      'resolved stream exposes at least one audio track')
  } catch (err) {
    ok(err && typeof err === 'object',
      'rejection is object-like')
    ok(typeof err.name === 'string',
      'rejection includes an error name')
    ok(err.name === 'NotSupportedError' || err.name === 'NotFoundError',
      'rejection uses a supported getUserMedia error name')
    ok(typeof err.message === 'string' && err.message.length > 0,
      'rejection includes a non-empty message')
  }
})
