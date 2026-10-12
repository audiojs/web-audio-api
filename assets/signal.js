import fft from './fft.js'

const phonePlots = globalThis.matchMedia?.('(max-width: 40rem), (pointer: coarse) and (max-height: 40rem)')
export const plotsVisible = () => !phonePlots?.matches

const SIZE = 2048
const window = Float64Array.from({ length: SIZE }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / SIZE))

// Four seconds of audio-time history, not four seconds of animation callbacks.
export class SignalHistory {
  constructor(sampleRate, duration = 4) {
    this.sampleRate = sampleRate
    this.duration = duration
    this.frames = []
    this.samples = new Float32Array(SIZE)
    this.windowed = new Float64Array(SIZE)
    this.magnitudes = new Float64Array(SIZE / 2)
    this.end = 0
    this.version = 0
  }

  push(samples, end) {
    if (!samples.length || end <= this.end) return
    const start = end - samples.length / this.sampleRate
    // Do not bridge an actual capture gap with old samples.
    if (start - this.end > 1 / this.sampleRate) this.samples.fill(0)
    this.samples.copyWithin(0, samples.length)
    this.samples.set(samples, SIZE - samples.length)
    let peak = 0, energy = 0
    for (let value of samples) { peak = Math.max(peak, Math.abs(value)); energy += value * value }
    for (let i = 0; i < SIZE; i++) this.windowed[i] = this.samples[i] * window[i]
    fft(this.windowed, this.magnitudes)
    const spectrum = Uint8Array.from(this.magnitudes, value => {
      // Hann coherent gain is 0.5; display -100 to -20 dBFS.
      const db = 20 * Math.log10(Math.max(1e-12, value * 2))
      return Math.round(Math.max(0, Math.min(255, (db + 100) / 80 * 255)))
    })
    this.frames.push({ start, end, peak, rms: Math.sqrt(energy / samples.length), spectrum })
    this.end = end
    while (this.frames[0]?.end < end - this.duration) this.frames.shift()
    this.version++
  }

  // Where audio time `end` falls on the grid of `count` cells per `duration`, in cells from time zero.
  // Recover the integer sample clock first: 0.06 - 0.01 can be slightly below
  // 0.05, which would otherwise paint the preceding cell too.
  position(count, duration = this.duration, end = this.end) {
    return Math.round(end * this.sampleRate) * count / (duration * this.sampleRate)
  }

  // The `count` cells up to the one holding `end`. Bin against a fixed audio-time grid:
  // moving the bin boundaries with each delivery made old transients alternate
  // between one and two columns wide.
  columns(count, duration = this.duration, end = this.end) {
    const columns = Array.from({ length: count }, () => null)
    const span = duration * this.sampleRate
    const first = Math.ceil(this.position(count, duration, end)) - count
    for (const frame of this.frames) {
      let from = Math.max(0, Math.floor(Math.round(frame.start * this.sampleRate) * count / span) - first)
      let to = Math.min(count, Math.ceil(Math.round(frame.end * this.sampleRate) * count / span) - first)
      for (let i = from; i < to; i++) {
        const previous = columns[i]
        // Preserve brief peaks when several captured blocks share a display column.
        if (!previous || frame.peak > previous.peak) columns[i] = frame
      }
    }
    return columns
  }
}

// The audio time to draw now: what the speakers are sounding, interpolated between
// render callbacks so the plots scroll on every display frame, held one capture
// block back so the newest cell has already arrived.
export function signalTime(context, history) {
  const latest = history.frames.at(-1)
  if (!latest || context.state !== 'running') return history.end
  const { contextTime, performanceTime } = context.getOutputTimestamp?.() || {}
  const heard = performanceTime > 0 ? contextTime + (performance.now() - performanceTime) / 1000 : context.currentTime
  return Math.min(history.end, heard - (latest.end - latest.start))
}

const modules = new WeakMap()
export async function observeSignal(context, source) {
  if (!plotsVisible() || !context.audioWorklet || !globalThis.AudioWorkletNode) return null
  const history = new SignalHistory(context.sampleRate)
  let capture = null
  const dispose = () => {
    if (!capture) return
    capture.port.onmessage = null
    capture.port.close()
    try { source.disconnect(capture) } catch {}
    capture.disconnect()
    capture = null
  }
  try {
    let loaded = modules.get(context)
    if (!loaded) {
      loaded = context.audioWorklet.addModule(new URL('./signal-worklet.js', import.meta.url))
      modules.set(context, loaded)
    }
    await loaded
    if (context.state === 'closed' || !plotsVisible()) return null
    capture = new AudioWorkletNode(context, 'site-signal', {
      numberOfInputs: 1, numberOfOutputs: 0, channelCount: 1, channelCountMode: 'explicit',
    })
    capture.port.onmessage = ({ data }) => {
      if (plotsVisible()) history.push(data.samples, data.end)
      capture.port.postMessage(data.samples.buffer, [data.samples.buffer])
    }
    source.connect(capture)
    return { history, dispose }
  } catch {
    dispose()
    modules.delete(context)
    // Playback remains available; callers explicitly report unavailable visualization.
    return null
  }
}
