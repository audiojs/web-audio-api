// Only the worker loads the DSP bundle. The page receives ordinary PCM samples.
export function renderAudio(id, options = {}, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Render cancelled', 'AbortError'))
    const worker = new Worker(new URL('./render-worker.bundle.js', import.meta.url), { type: 'module' })
    const finish = (error, result) => {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
      worker.terminate()
      error ? reject(error) : resolve(result)
    }
    const abort = () => finish(new DOMException('Render cancelled', 'AbortError'))
    const timeout = setTimeout(() => finish(new Error('Audio rendering timed out')), 60000)
    signal?.addEventListener('abort', abort, { once: true })
    worker.onerror = event => {
      event.preventDefault()
      finish(new Error(event.message || 'Audio renderer could not load'))
    }
    worker.onmessageerror = () => finish(new Error('Audio renderer returned unreadable samples'))
    worker.onmessage = ({ data }) => {
      if (data.error) return finish(new Error(data.error))
      try {
        const buffer = new AudioBuffer({ numberOfChannels: data.channels.length, length: data.channels[0].length, sampleRate: data.sampleRate })
        data.channels.forEach((samples, ch) => buffer.copyToChannel(samples, ch))
        finish(null, { buffer, renderMs: data.renderMs })
      } catch (error) { finish(error) }
    }
    try { worker.postMessage({ id, ...options }) }
    catch (error) { finish(error) }
  })
}
