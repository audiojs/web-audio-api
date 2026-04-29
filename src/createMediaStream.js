// Wrap a PCM source as a MediaStream-shaped object that
// `ctx.createMediaStreamSource()` can consume.
//
// Accepts: callback reader `fn(cb)` | async iterable | sync iterable
// | Node Readable (objects with `.on('data', ...)`)
// Chunks: Float32Array (mono) | Float32Array[] (planar) | interleaved Int PCM
// Buffer/Uint8Array (set `channels` + `bitDepth`, default 1/16).

let nextId = 0
let makeTrack = (settings = {}) => ({
  id: 'track-' + (++nextId), kind: 'audio', enabled: true, readyState: 'live',
  stop() { this.readyState = 'ended' },
  clone() { return makeTrack(settings) },
  getSettings: () => ({ ...settings }),
})

// Convert one chunk into Float32Array (mono) or Float32Array[] (planar).
function normalize(chunk, channels, bitDepth) {
  if (chunk instanceof Float32Array) return chunk
  if (Array.isArray(chunk) && chunk[0] instanceof Float32Array) return chunk
  if (chunk?.buffer instanceof ArrayBuffer) {
    let bps = bitDepth / 8
    let frames = (chunk.length / (channels * bps)) | 0
    let planes = Array.from({ length: channels }, () => new Float32Array(frames))
    let view = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength)
    let scale = 1 / (1 << (bitDepth - 1))
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < channels; c++) {
        let off = (i * channels + c) * bps
        let s = bitDepth === 16 ? view.getInt16(off, true)
              : bitDepth === 32 ? view.getInt32(off, true)
              : (view.getUint8(off) | (view.getUint8(off + 1) << 8) | (view.getInt8(off + 2) << 16))
        planes[c][i] = s * scale
      }
    }
    return channels === 1 ? planes[0] : planes
  }
  throw new TypeError('createMediaStream: chunk must be Float32Array, Float32Array[], or Int PCM Buffer')
}

export default function createMediaStream(source, { channels = 1, bitDepth = 16 } = {}) {
  let track = makeTrack({ channelCount: channels, sampleSize: bitDepth })
  let stream = {
    _buffers: [],  // drained by MediaStreamAudioSourceNode
    getTracks: () => [track],
    getAudioTracks: () => [track],
    getVideoTracks: () => [],
  }
  let push = chunk => { if (chunk) try { stream._buffers.push(normalize(chunk, channels, bitDepth)) } catch {} }

  if (typeof source === 'function') {
    let pump = () => source((err, c) => { if (!err && c) { push(c); pump() } })
    pump()
  } else if (source?.[Symbol.asyncIterator]) {
    ;(async () => { for await (let c of source) push(c) })()
  } else if (typeof source?.on === 'function') {
    source.on('data', push)
  } else if (source?.[Symbol.iterator]) {
    for (let c of source) push(c)
  } else {
    throw new TypeError('createMediaStream: source must be a callback reader, async iterable, sync iterable, or Node Readable')
  }

  return stream
}
