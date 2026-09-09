import OfflineAudioContext from '../src/OfflineAudioContext.js'
import { context as heroContext } from './hero-offline-context.js'

// Built as render-worker.bundle.js. Each worker owns one render and is then terminated.
self.onmessage = async ({ data: { id, duration, sampleRate = 44100, options = {}, channels } }) => {
  try {
    let context
    if (id === 'hero') {
      await import('../hero.js')
      context = heroContext
    } else {
      if (!['linked-params', 'fft', 'render-to-buffer', 'process-file'].includes(id))
        throw new Error(`Unknown offline example: ${id}`)
      context = new OfflineAudioContext(channels?.length || 2, channels?.[0].length || Math.ceil(duration * sampleRate), sampleRate)
      const url = new URL(`../examples/graphs/${id}.js`, import.meta.url)
      const { init } = await import(url.href)
      if (channels) {
        const input = context.createBuffer(channels.length, channels[0].length, sampleRate)
        channels.forEach((samples, ch) => input.copyToChannel(samples, ch))
        await init(context, input, { ...options, when: 0 })
      } else await init(context, { ...options, duration, when: 0 })
    }
    const started = performance.now()
    const buffer = await context.startRendering()
    const renderMs = performance.now() - started
    const output = Array.from({ length: buffer.numberOfChannels }, (_, ch) => buffer.getChannelData(ch))
    self.postMessage({ sampleRate: buffer.sampleRate, channels: output, renderMs }, [...new Set(output.map(samples => samples.buffer))])
  } catch (error) {
    self.postMessage({ error: error.message })
  }
}
