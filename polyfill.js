// Web Audio API globals for Node: `import 'web-audio-api/polyfill'`
import * as waa from './index.js'

for (let [name, value] of Object.entries(waa))
  if (typeof value === 'function' && !(name in globalThis)) globalThis[name] = value

// Tone.js / standardized-audio-context checks `instanceof window.AudioParam`
if (typeof window === 'undefined') globalThis.window = globalThis

globalThis.MediaStreamTrack ??= waa.MediaStreamTrack
globalThis.MediaStream ??= waa.MediaStream
globalThis.CustomMediaStreamTrack ??= waa.CustomMediaStreamTrack

globalThis.navigator ??= {}
globalThis.navigator.mediaDevices ??= {}

const legacyGetUserMedia = typeof globalThis.navigator.getUserMedia === 'function'
  ? globalThis.navigator.getUserMedia.bind(globalThis.navigator)
  : undefined

const installedGetUserMedia =
  typeof waa.getUserMedia === 'function'
    ? waa.getUserMedia.bind(waa)
    : typeof legacyGetUserMedia === 'function'
      ? (constraints) =>
          new Promise((resolve, reject) => {
            legacyGetUserMedia(constraints, resolve, reject)
          })
      : () =>
          Promise.reject(
            new TypeError('navigator.mediaDevices.getUserMedia is not implemented')
          )

globalThis.navigator.mediaDevices.getUserMedia ??= installedGetUserMedia
globalThis.navigator.getUserMedia ??= function (constraints, successCallback, errorCallback) {
  globalThis.navigator.mediaDevices.getUserMedia(constraints).then(
    (stream) => {
      if (typeof successCallback === 'function') successCallback(stream)
    },
    (error) => {
      if (typeof errorCallback === 'function') errorCallback(error)
    }
  )
}
