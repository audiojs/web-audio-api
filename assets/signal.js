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

  columns(count, duration = this.duration) {
    const columns = Array.from({ length: count }, () => null)
    // Bin against a fixed audio-time grid. Moving the bin boundaries with each
    // delivery made old transients alternate between one and two columns wide.
    // Recover the integer sample clock before binning: 0.06 - 0.01 can be
    // slightly below 0.05, which would otherwise paint the preceding cell too.
    const span = duration * this.sampleRate
    const first = Math.ceil(Math.round(this.end * this.sampleRate) * count / span) - count
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
