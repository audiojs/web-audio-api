import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runHero } from '../scripts/render.mjs'

let reference
export async function testPreview(browser, url) {
  reference ||= runHero(readFileSync(new URL('../hero.js', import.meta.url), 'utf8'), 1)
  const expected = Array.from((await reference).audio.getChannelData(0))
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    globalThis.__workers = new Set()
    globalThis.__outputs = []
    const Worker = globalThis.Worker, AudioContext = globalThis.AudioContext
    globalThis.Worker = class extends Worker {
      constructor(...args) { super(...args); __workers.add(this) }
      terminate() { __workers.delete(this); super.terminate() }
    }
    globalThis.AudioContext = class extends AudioContext {
      constructor(...args) { super(...args); __outputs.push(this) }
    }
  })
  try {
    await page.goto(url)
    const toggle = page.locator('#hero-engine'), play = page.locator('[data-run]')
    const timing = page.locator('#hero-render-time')
    assert.equal(await timing.textContent(), '', 'no timing before the first render')
    const idle = () => page.waitForFunction(() => !document.querySelector('[data-run]').dataset.state && __workers.size === 0 && __outputs.every(context => context.state === 'closed'))
    const playing = () => page.waitForFunction(() => document.querySelector('[data-run]').dataset.state === 'running' && !document.querySelector('[data-run]').hasAttribute('aria-busy'))
    assert.equal(await toggle.getAttribute('aria-checked'), 'true')
    assert.equal(await page.evaluate(() => __workers.size + __outputs.length), 0, 'initial view loads no worker or audio device')
    const rendered = await page.evaluate(async () => {
      const { renderAudio } = await import('/assets/render.js')
      const { buffer, renderMs } = await renderAudio('hero')
      return { renderMs, rate: buffer.sampleRate, length: buffer.length, channels: buffer.numberOfChannels, samples: Array.from(buffer.getChannelData(0).subarray(0, 44100)), active: __workers.size }
    })
    assert.equal(rendered.length, 6 * 44100)
    assert.equal(rendered.rate, 44100)
    assert.ok(Number.isFinite(rendered.renderMs) && rendered.renderMs >= 0, 'worker reports measured offline render time')
    assert.equal(rendered.channels, 2)
    assert.deepEqual(rendered.samples, expected, 'worker runs the same hero graph and produces the Node samples')
    assert.equal(rendered.active, 0, 'completed worker is terminated')
    const offline = await page.evaluate(async () => {
      const { renderAudio } = await import('/assets/render.js')
      const results = []
      for (const id of ['fft', 'linked-params', 'render-to-buffer']) {
        const { buffer } = await renderAudio(id, { duration: 0.1 })
        results.push({ length: buffer.length, audible: buffer.getChannelData(0).some(value => Math.abs(value) > 0.001) })
      }
      const samples = Float32Array.from({ length: 4410 }, (_, i) => Math.sin(i * 2 * Math.PI * 440 / 44100) * 0.2)
      const { buffer: processed } = await renderAudio('process-file', { channels: [samples], sampleRate: 44100 })
      const invalid = await renderAudio('unknown').then(() => '', error => error.message)
      const controller = new AbortController()
      const cancelled = renderAudio('hero', {}, controller.signal).catch(error => error.name)
      controller.abort()
      return { results, channels: processed.numberOfChannels, processed: processed.length, invalid, cancelled: await cancelled, active: __workers.size, outputs: __outputs.length }
    })
    assert.deepEqual(offline.results, Array(3).fill({ length: 4410, audible: true }))
    assert.equal(offline.channels, 1)
    assert.equal(offline.processed, 4410)
    assert.match(offline.invalid, /Unknown offline example/)
    assert.equal(offline.cancelled, 'AbortError')
    assert.equal(offline.active, 0)
    assert.equal(offline.outputs, 0, 'offline examples never open a speaker context')

    const cancelledSetup = await page.evaluate(async () => {
      const { PreviewContext } = await import('/assets/hero-context.js')
      const original = AudioWorklet.prototype.addModule
      AudioWorklet.prototype.addModule = () => new Promise(() => {})
      try {
        const context = new PreviewContext()
        const ready = context.resume().then(() => ({ rejected: false }), error => ({ rejected: true, error: String(error) }))
        await context.close()
        return { capture: await context.capture, state: context.state, resumed: await ready }
      } finally { AudioWorklet.prototype.addModule = original }
    })
    assert.equal(cancelledSetup.capture, null)
    assert.equal(cancelledSetup.state, 'closed')
    assert.equal(cancelledSetup.resumed.rejected, true, `stop rejects resume even when capture setup never finishes: ${JSON.stringify(cancelledSetup)}`)

    await play.click(); await playing()
    assert.match(await timing.textContent(), /^6 s rendered in [\d.]+ (ms|s)$/)
    await page.locator('#hero-volume').fill('25')
    assert.equal(await page.evaluate(() => __outputs.at(-1).level.gain.value), 0.25)
    await toggle.focus(); await page.keyboard.press('Space'); await playing()
    assert.equal(await timing.textContent(), '', 'live native playback has no offline timing')
    assert.equal(await toggle.getAttribute('aria-checked'), 'false', 'keyboard selects native and restarts playback')
    assert.equal(await page.evaluate(() => __outputs.filter(context => context.state !== 'closed').length), 1, `engine change closes the previous output: ${JSON.stringify(await page.evaluate(() => __outputs.map(context => ({ state: context.state, time: context.currentTime, level: context.level?.gain.value }))))}`)
    await toggle.click(); await toggle.click(); await toggle.click(); await playing()
    assert.equal(await toggle.getAttribute('aria-checked'), 'true')
    assert.equal(await page.evaluate(() => __outputs.filter(context => context.state !== 'closed').length), 1, 'rapid switching leaves one output')
    await play.click(); await idle()
    assert.equal(await play.getAttribute('aria-label'), 'Play preview')

    // Cancelling while the bundle is still downloading must not start late audio.
    let release, requested
    const requestedWorker = new Promise(resolve => { requested = resolve })
    const held = new Promise(resolve => { release = resolve })
    await page.route('**/render-worker.bundle.js', async route => { requested(); await held; await route.continue().catch(() => {}) })
    await play.click(); await requestedWorker
    assert.equal(await timing.textContent(), '', 'pending renders clear the previous timing')
    await play.click(); await idle()
    release()
    await page.unroute('**/render-worker.bundle.js')
    assert.equal(await play.getAttribute('aria-busy'), null)

    await page.route('**/render-worker.bundle.js', route => route.abort())
    await play.click()
    await page.waitForFunction(() => document.querySelector('.hero-play-status').textContent.includes('could not render'))
    await idle()
    await page.unroute('**/render-worker.bundle.js')
    await play.click(); await playing()
    assert.equal(await page.locator('.hero-play-status').textContent(), '', 'a failed bundle load can be retried')
    await idle() // natural end closes the device
    assert.match(await timing.textContent(), /^6 s rendered in /, 'finished playback retains its render measurement')
    await toggle.click(); await play.click(); await playing(); await idle()

    await page.evaluate(() => {
      globalThis.__addModule = AudioWorklet.prototype.addModule
      AudioWorklet.prototype.addModule = () => Promise.reject(new Error('Capture unavailable'))
    })
    await toggle.click(); await play.click(); await playing()
    assert.match(await page.locator('.hero-play-status').textContent(), /visualization unavailable/, 'capture failure keeps audio playing and explains the missing visualization')
    await play.click(); await idle()
    await page.evaluate(() => { AudioWorklet.prototype.addModule = globalThis.__addModule })

    // Loading feedback and render timing must never move the hero or its controls.
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 960 })
      await page.evaluate(() => document.fonts.ready)
      const layout = () => page.evaluate(() => {
        const hero = document.querySelector('.hero-code').getBoundingClientRect()
        const bar = document.querySelector('.hero-code .demo-runbar').getBoundingClientRect()
        const play = document.querySelector('[data-run]').getBoundingClientRect()
        return [hero.height, bar.height, bar.top - hero.top, play.left - hero.left]
      })
      const before = await layout()
      let release, requested
      const request = new Promise(resolve => { requested = resolve })
      const held = new Promise(resolve => { release = resolve })
      await page.route('**/render-worker.bundle.js', async route => { requested(); await held; await route.continue().catch(() => {}) })
      try {
        await play.click(); await request
        assert.equal(await page.locator('.hero-play-status').textContent(), 'Rendering…')
        assert.deepEqual(await layout(), before, `loading keeps the hero and controls fixed at ${width}px`)
        release(); await playing()
        assert.deepEqual(await layout(), before, `render timing keeps the hero and controls fixed at ${width}px`)
        await play.click(); await idle()
        assert.deepEqual(await layout(), before, `stopping keeps the hero and controls fixed at ${width}px`)
      } finally {
        release()
        await page.unroute('**/render-worker.bundle.js')
      }
    }

    await page.goto(`${url}/examples/render-to-buffer/`)
    await page.locator('#demo-run').click()
    await page.waitForFunction(() => document.querySelector('#demo-status').textContent.startsWith('Rendered '))
    assert.equal(await page.locator('#demo-result audio').count(), 1, 'offline example renders downloadable audio through the worker')
    assert.equal(await page.evaluate(() => __workers.size), 0)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
}
