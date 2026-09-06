// Install browsers once: npx playwright install chromium webkit
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, webkit } from 'playwright'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' }
const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    if (path.endsWith('/')) path += 'index.html'
    const file = resolve(root, '.' + path)
    if (!file.startsWith(root + sep)) throw Error('Outside root')
    res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream')
    res.end(await readFile(file))
  } catch { res.writeHead(404); res.end() }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const url = `http://127.0.0.1:${server.address().port}`
try {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch({ headless: true })
    try {
      const hoverPage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
      try {
        await hoverPage.goto(url)
        await hoverPage.evaluate(() => { for (const detail of document.querySelectorAll('.faq details')) detail.open = true })
        const rows = hoverPage.locator('[aria-label="Runtime support"] tbody tr')
        const snapshot = () => rows.evaluateAll(rows => rows.map(row => ({
          filter: getComputedStyle(row.querySelector('.runtime-mark')).filter,
          background: getComputedStyle(row).backgroundColor,
        })))
        const white = await hoverPage.evaluate(() => {
          const probe = document.createElement('span'); probe.style.color = 'var(--color-white)'; document.body.append(probe)
          const value = getComputedStyle(probe).color; probe.remove(); return value
        })
        const baseline = await snapshot()
        assert.ok(baseline.every(row => row.filter === 'grayscale(1)'))
        for (const selected of [0, 0, 1]) {
          await rows.nth(selected).hover()
          const states = await snapshot()
          for (let i = 0; i < states.length; i++) assert.deepEqual(states[i], i === selected ? { filter: 'none', background: white } : baseline[i], 'runtime hover A → A → B colours and highlights only the selected row')
        }
        await hoverPage.locator('.bench tbody tr').first().hover()
        assert.deepEqual(await snapshot(), baseline, 'leaving the runtime table restores its neutral rows')
        assert.notEqual(await hoverPage.locator('.bench tbody tr').first().evaluate(row => getComputedStyle(row).backgroundColor), white, 'the runtime highlight does not leak into benchmark tables')
        const badge = hoverPage.locator('.wpt-seal')
        const badgeColor = await badge.evaluate(node => getComputedStyle(node).color)
        await badge.hover()
        assert.equal(await badge.evaluate(node => getComputedStyle(node).color), badgeColor, 'the black WPT badge retains its light text on hover')
      } finally { await hoverPage.close() }
      const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
      const errors = []
      page.on('pageerror', e => errors.push(e.message))
      await page.goto(url)
      await page.evaluate(() => document.fonts.ready)
      for (const width of [320, 375, 414, 768, 900, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        await page.evaluate(() => { for (const d of document.querySelectorAll('.faq details')) d.open = true })
        await page.waitForTimeout(250)
        const issues = await page.evaluate(() => {
          const problems = []
          if (document.documentElement.scrollWidth > innerWidth) problems.push('page overflow')
          for (const e of document.querySelectorAll('.hero-stack button, .faq summary, .hero-intro h1, .wpt-seal, .hero-demo-note, .footer-license')) {
            const r = e.getBoundingClientRect()
            if (r.right > innerWidth + 1 || r.left < -1 || e.scrollWidth > e.clientWidth + 1) problems.push(e.textContent)
          }
          const bounds = selector => document.querySelector(selector).getBoundingClientRect()
          const art = bounds('.hero-art'), note = bounds('.hero-demo-note'), code = bounds('.hero-code')
          if (note.left < art.left || note.right > art.right || note.top < art.top || note.bottom > art.bottom || note.bottom > code.top) problems.push('caption detached from graph or overlapping code')
          const install = bounds('.install-command'), seal = bounds('.wpt-seal'), size = bounds('.hero-spec')
          if (innerWidth <= 640 && (size.left < install.right || size.top >= install.bottom || size.bottom <= install.top)) problems.push('archive size leaves the install line')
          if (Math.min(install.right, seal.right) > Math.max(install.left, seal.left) && Math.min(install.bottom, seal.bottom) > Math.max(install.top, seal.top)) problems.push('seal overlaps install command')
          const icons = [...document.querySelectorAll('.hero-stack .is-secondary img')].map(e => e.getBoundingClientRect())
          if (icons.slice(1).some((icon, i) => icon.left - icons[i].right > 17)) problems.push('secondary runtime icons too far apart')
          if (getComputedStyle(document.querySelector('.bench caption')).paddingLeft !== getComputedStyle(document.querySelector('.bench th')).paddingLeft) problems.push('benchmark note is not inset with its cells')
          for (const th of document.querySelectorAll('.table-scroll tbody th')) {
            if (getComputedStyle(th).whiteSpace !== 'nowrap') problems.push('wrapped row label')
          }
          return problems
        })
        assert.deepEqual(issues, [], `${engine.name()} ${width}px`)
      }
      await page.locator('.wpt-seal').focus()
      assert.ok(await page.locator('#wpt-tip').isVisible(), 'WPT numbers appear on keyboard focus')
      assert.ok((await page.locator('#wpt-tip').textContent()).includes('4,317 / 4,317'))
      await page.locator('.wpt-seal').evaluate(element => element.blur())
      for (const viewport of [{ width: 375, height: 812 }, { width: 812, height: 375 }]) {
        await page.setViewportSize(viewport)
        assert.equal(await page.locator('.hero-signal').isVisible(), false, 'phone plots are hidden in either orientation')
        const skipped = await page.evaluate(async () => {
          const { observeSignal } = await import('/assets/signal.js')
          let loads = 0
          const capture = await observeSignal({ sampleRate: 48000, audioWorklet: { addModule() { loads++; return Promise.resolve() } } }, {})
          return { capture, loads }
        })
        assert.deepEqual(skipped, { capture: null, loads: 0 }, 'phone capture performs no worklet loading or FFT setup')
      }
      // The same flex child serves static pages and the modal. At desktop widths
      // align-self:start used to shrink it, leaving an unpainted strip on the right.
      const plotsFit = async target => {
        await target.evaluate(() => Promise.all((document.querySelector('.dialog-shell')?.getAnimations() || []).map(animation => animation.finished)))
        // First inspect the settled initial mount without a corrective resize.
        for (const width of [null, 320, 375, 375, 414, 640, 641, 768, 959, 960, 1024, 1440]) {
          if (width !== null) await target.setViewportSize({ width, height: 900 })
          await target.waitForTimeout(100)
          const gaps = await target.evaluate(() => {
            const rect = selector => document.querySelector(selector).getBoundingClientRect()
            const column = rect('.demo-column'), panel = rect('.demo-panel'), stage = rect('.demo-stage')
            const css = getComputedStyle(document.querySelector('.demo-stage'))
            const hidden = matchMedia('(max-width: 40rem), (pointer: coarse) and (max-height: 40rem)').matches
            if (hidden) return css.display === 'none' ? [] : [Infinity]
            return [panel.left - column.left, column.right - panel.right,
              ...['.demo-canvas', '.demo-spectrogram'].flatMap(selector => {
                const canvas = rect(selector), element = document.querySelector(selector)
                const ratio = Math.min(devicePixelRatio, Math.min(innerWidth, innerHeight) < 500 ? 1 : 2)
                return [canvas.left - stage.left - parseFloat(css.paddingLeft), stage.right - canvas.right - parseFloat(css.paddingRight),
                  element.width - Math.round(element.clientWidth * ratio), element.height - Math.round(element.clientHeight * ratio)]
              })]
          })
          assert.ok(gaps.every(gap => Math.abs(gap) < 1), `${engine.name()} ${width === null ? 'initial mount' : width + 'px'}: plots fill the column within the pixel budget (${gaps})`)
        }
      }
      await page.locator('[data-open-example="metronome"]').click()
      await plotsFit(page)
      await page.setViewportSize({ width: 375, height: 812 })
      await page.locator('#demo-run').click()
      await page.waitForFunction(() => document.querySelector('#demo-run').dataset.state === 'running')
      assert.equal(await page.locator('.demo-stage').isVisible(), false, 'phone playback does not reveal hidden plots')
      assert.ok(!(await page.locator('#demo-status').textContent()).includes('unavailable'), 'intentionally hidden plots are not reported as a failure')
      await page.locator('#demo-run').click()
      await page.locator('[data-close-dialog]').click()
      const detail = await browser.newPage({ deviceScaleFactor: 2 })
      try {
        await detail.goto(url + '/examples/tone/')
        await detail.evaluate(() => document.fonts.ready)
        await plotsFit(detail)
      } finally { await detail.close() }
      for (const deviceScaleFactor of [1, 2, 3]) {
        const pixels = await browser.newPage({ viewport: { width: 1024, height: 900 }, deviceScaleFactor })
        try {
          await pixels.route('**/examples/browser.js', async route => route.fulfill({ contentType: 'text/javascript', body: await readFile(resolve(root, 'examples/browser.js'), 'utf8') + '\nexport { drawLiveSignal, setAudioResult, clearAudioResult, audioBufferToWav };' }))
          await pixels.goto(url + '/examples/render-to-buffer/')
          const footprints = await pixels.evaluate(async () => {
            const { drawLiveSignal } = await import('/examples/browser.js')
            const { SignalHistory } = await import('/assets/signal.js')
            const wave = document.createElement('canvas'), spectrum = document.createElement('canvas')
            for (const canvas of [wave, spectrum]) { canvas.style.cssText = 'width:519px;height:113px'; document.body.append(canvas) }
            const history = new SignalHistory(48000), frames = []
            const footprint = (canvas, wave) => {
              const { width, height } = canvas, data = canvas.getContext('2d').getImageData(0, 0, width, height).data
              let left = width, right = -1, top = height, bottom = -1
              for (let y = 0; y < (wave ? Math.floor(height / 2) - 2 : height); y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3]) {
                left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y)
              }
              const rgba = []
              for (let y = top; y <= bottom; y++) rgba.push(...data.slice((y * width + left) * 4, (y * width + right + 1) * 4))
              return { left, width: right - left + 1, height: bottom - top + 1, rgba }
            }
            for (let n = 0; n < 40; n++) {
              history.push(new Float32Array(1024).fill(n ? 0 : 0.5), 0.09 + n * 1024 / 48000)
              history.frames.at(-1).spectrum.fill(n ? 0 : 255)
              drawLiveSignal(wave, spectrum, history, 'log')
              frames.push({ wave: footprint(wave, true), spectrum: footprint(spectrum, false) })
            }
            return frames
          })
          for (const kind of ['wave', 'spectrum']) {
            const first = footprints[0][kind]
            assert.ok(first.width > 0 && first.height > 0)
            for (const frame of footprints) {
              assert.equal(frame[kind].width, first.width, `${kind}: moving left cannot widen a completed transient`)
              assert.equal(frame[kind].height, first.height, `${kind}: moving left cannot shorten a completed transient`)
              assert.deepEqual(frame[kind].rgba, first.rgba, `${kind}: translated pixels are identical, not just nonempty`)
            }
            assert.ok(footprints.at(-1)[kind].left < first.left, `${kind}: the test actually scrolls`)
          }
          const playback = await pixels.evaluate(async () => {
            const { setAudioResult, clearAudioResult, audioBufferToWav } = await import('/examples/browser.js')
            const container = document.createElement('div'), urls = [], revoked = []
            const revoke = URL.revokeObjectURL
            URL.revokeObjectURL = url => { revoked.push(url); revoke.call(URL, url) }
            try {
              for (const [name, sample] of [['A', 0.25], ['A', 0.25], ['B', 0.5]]) {
                const buffer = { numberOfChannels: 1, length: 1, sampleRate: 8000, getChannelData: () => new Float32Array([sample]) }
                setAudioResult(container, audioBufferToWav(buffer), `${name}.wav`, name)
                urls.push(container.querySelector('audio').src)
              }
              const link = container.querySelector('a'), bytes = await (await fetch(link.href)).arrayBuffer()
              const result = { filename: link.download, label: link.getAttribute('aria-label'), bytes: bytes.byteLength, sample: new DataView(bytes).getInt16(44, true) }
              clearAudioResult(container); clearAudioResult(container)
              return { ...result, urls, revoked, children: container.childElementCount }
            } finally { URL.revokeObjectURL = revoke }
          })
          assert.equal(playback.filename, 'B.wav'); assert.equal(playback.label, 'Download B.wav')
          assert.equal(playback.bytes, 46); assert.equal(playback.sample, 16383, 'one-frame WAV carries B, not stale A')
          assert.equal(playback.children, 0)
          assert.deepEqual(playback.revoked, playback.urls, 'A → A → B → repeated clear releases each audio URL exactly once')
        } finally { await pixels.close() }
      }

      const phoneJazz = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })
      try {
        await phoneJazz.addInitScript(() => Object.defineProperty(globalThis, 'AudioWorkletNode', { value: undefined, configurable: true }))
        await phoneJazz.goto(url + '/examples/jazz/')
        await phoneJazz.locator('#demo-run').click()
        await phoneJazz.waitForFunction(() => /^[A-G]b?(m9|maj7|sus)$/.test(document.querySelector('#demo-status').textContent))
        assert.equal(await phoneJazz.locator('#demo-run').getAttribute('data-state'), 'running', 'jazz plays without AudioWorkletNode and displays its current chord')
        await phoneJazz.locator('#demo-run').click()
        await phoneJazz.goto(url + '/examples/render-to-buffer/')
        await phoneJazz.locator('#demo-run').click()
        await phoneJazz.locator('#demo-result audio').waitFor()
        const result = await phoneJazz.evaluate(() => {
          const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON()
          return { panel: rect('.demo-panel'), audio: rect('#demo-result audio'), download: rect('.demo-download'), form: rect('.demo-form'),
            border: getComputedStyle(document.querySelector('.demo-form')).borderTopWidth, label: document.querySelector('.demo-download').getAttribute('aria-label'), filename: document.querySelector('.demo-download').download }
        })
        assert.equal(result.form.height, 0, 'empty parameters collapse completely')
        assert.equal(result.border, '0px', 'hidden phone plot leaves no form divider')
        assert.ok(result.audio.y - result.panel.y < 25, 'no empty plot space above playback')
        assert.ok(result.download.x >= result.audio.right && Math.abs(result.audio.y + result.audio.height / 2 - result.download.y - result.download.height / 2) < 1, 'humble download icon stays inline with native audio')
        assert.equal(result.filename, 'render-to-buffer.wav')
        assert.equal(result.label, 'Download render-to-buffer.wav')
        await phoneJazz.setViewportSize({ width: 1440, height: 900 })
        await phoneJazz.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        const edges = await phoneJazz.evaluate(() => ['.demo-stage', '.demo-results', '.dialog-foot'].map(selector => {
          const rect = document.querySelector(selector).getBoundingClientRect(); return [rect.top, rect.bottom]
        }))
        assert.ok(Math.abs(edges[0][1] - edges[1][0]) < 1 && Math.abs(edges[1][1] - edges[2][0]) < 1, 'offline plot, native player and footer meet without an empty parameter-sized strip')
        await phoneJazz.goto(url + '/examples/recorder/')
        await phoneJazz.evaluate(() => {
          const Context = AudioContext
          // Stub the device boundary: this test concerns recording ownership, not capture.
          globalThis.AudioContext = class extends Context { createMediaStreamSource() { return this.createGain() } }
          Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => new MediaStream() } })
          globalThis.__recordings = []
          globalThis.MediaRecorder = class {
            mimeType = 'audio/webm'
            state = 'inactive'
            start() { this.state = 'recording'; __recordings.push(this) }
            stop() { this.state = 'inactive' } // hold final delivery until the test releases it
          }
        })
        for (let i = 0; i < 2; i++) {
          await phoneJazz.locator('#demo-run').click()
          await phoneJazz.waitForFunction(count => globalThis.__recordings.length === count && !document.querySelector('#demo-run').hasAttribute('aria-busy'), i + 1)
          if (!i) { await phoneJazz.locator('#demo-run').click(); await phoneJazz.waitForFunction(() => document.querySelector('#demo-run').dataset.state === 'default') }
        }
        await phoneJazz.evaluate(() => {
          __recordings[0].ondataavailable({ data: new Blob(['A']) })
          __recordings[1].ondataavailable({ data: new Blob([]) })
          __recordings[1].ondataavailable({ data: new Blob(['B']) })
          __recordings[0].onstop()
        })
        assert.equal(await phoneJazz.locator('#demo-result audio').count(), 0, 'late recording A cannot replace active recording B')
        await phoneJazz.locator('#demo-run').click()
        await phoneJazz.waitForFunction(() => document.querySelector('#demo-run').dataset.state === 'default')
        await phoneJazz.evaluate(() => __recordings[1].onstop())
        assert.equal(await phoneJazz.evaluate(async () => (await fetch(document.querySelector('.demo-download').href)).text()), 'B', 'recording B owns its chunks, excluding empty input and late A data')
        // Both contexts are closed before either recording completes. A null context
        // must not let an older result reclaim ownership of this reusable UI.
        for (let i = 2; i < 4; i++) {
          await phoneJazz.locator('#demo-run').click()
          await phoneJazz.waitForFunction(count => __recordings.length === count && !document.querySelector('#demo-run').hasAttribute('aria-busy'), i + 1)
          await phoneJazz.evaluate(index => __recordings[index].ondataavailable({ data: new Blob([index === 2 ? 'C' : 'D']) }), i)
          await phoneJazz.locator('#demo-run').click()
          await phoneJazz.waitForFunction(() => document.querySelector('#demo-run').dataset.state === 'default')
        }
        await phoneJazz.evaluate(() => __recordings[3].onstop())
        const latestURL = await phoneJazz.locator('.demo-download').getAttribute('href')
        await phoneJazz.evaluate(() => __recordings[2].onstop())
        assert.equal(await phoneJazz.locator('.demo-download').getAttribute('href'), latestURL, 'stopped recording D keeps its URL when older C completes later')
        assert.equal(await phoneJazz.evaluate(async () => (await fetch(document.querySelector('.demo-download').href)).text()), 'D', 'closed-context completion order cannot replace D bytes with C')
        await phoneJazz.locator('#demo-run').click()
        await phoneJazz.waitForFunction(() => __recordings.length === 5 && !document.querySelector('#demo-run').hasAttribute('aria-busy'))
        await phoneJazz.evaluate(() => __recordings[4].ondataavailable({ data: new Blob([]) }))
        await phoneJazz.locator('#demo-run').click()
        await phoneJazz.waitForFunction(() => document.querySelector('#demo-run').dataset.state === 'default')
        await phoneJazz.evaluate(() => __recordings[4].onstop())
        assert.equal(await phoneJazz.locator('.demo-download').getAttribute('href'), latestURL, 'zero-data recording preserves the last playable result instead of creating an empty player')
        await phoneJazz.evaluate(() => { dispatchEvent(new Event('pagehide')); __recordings[0].onstop() })
        assert.equal(await phoneJazz.locator('#demo-result audio').count(), 0, 'disposed recording callbacks cannot restore cleared playback')
      } finally { await phoneJazz.close() }

      const reuse = await browser.newPage({ viewport: { width: 375, height: 812 } })
      try {
        await reuse.goto(url + '/examples/noise/')
        await reuse.evaluate(() => {
          const Context = AudioContext
          globalThis.__runs = []; globalThis.__closeReleases = []; globalThis.__holdClose = true
          globalThis.AudioContext = class extends Context {
            constructor(...args) { super(...args); __runs.push(this) }
            close() { return super.close().then(() => __holdClose ? new Promise(resolve => __closeReleases.push(resolve)) : undefined) }
          }
        })
        const ready = count => reuse.waitForFunction(count => __runs.length === count && !document.querySelector('#demo-run').hasAttribute('aria-busy'), count)
        await reuse.locator('#demo-run').click(); await ready(1)
        await reuse.locator('[name="color"]').selectOption('pink')
        await reuse.waitForFunction(() => __closeReleases.length === 1)
        // The parameter reload is awaiting A's close; start B before releasing it.
        await reuse.locator('#demo-run').click(); await ready(2)
        await reuse.evaluate(async () => { __closeReleases.shift()(); await new Promise(resolve => setTimeout(resolve, 0)) })
        assert.equal(await reuse.evaluate(() => __runs.length), 2, 'stale parameter reload cannot create a third context after B starts')
        assert.equal(await reuse.locator('#demo-run').getAttribute('data-state'), 'running', 'old reload close cannot reset B controls')
        // Repeat through the direct stop/start path, without changing the parameters.
        await reuse.locator('#demo-run').click()
        await reuse.waitForFunction(() => __closeReleases.length === 1)
        await reuse.locator('#demo-run').click(); await ready(3)
        await reuse.evaluate(async () => { __closeReleases.shift()(); await new Promise(resolve => setTimeout(resolve, 0)) })
        assert.equal(await reuse.locator('#demo-run').getAttribute('data-state'), 'running', 'late manual close cannot reset a restarted run')
        assert.equal(await reuse.locator('#demo-status').textContent(), '', 'intentionally hidden phone plots produce no unavailable warning')
        await reuse.evaluate(() => { __holdClose = false })
        await reuse.locator('#demo-run').click()
        await reuse.waitForFunction(() => document.querySelector('#demo-run').dataset.state === 'default')
      } finally { await reuse.close() }

      const setupRace = await browser.newPage({ viewport: { width: 1024, height: 900 } })
      try {
        await setupRace.goto(url)
        await setupRace.evaluate(() => {
          const load = AudioWorklet.prototype.addModule
          AudioWorklet.prototype.addModule = async function (...args) {
            await load.apply(this, args)
            if (String(args[0]).endsWith('/signal-worklet.js')) await new Promise(resolve => { globalThis.__releaseCapture = resolve })
          }
          addEventListener('audiocontext', event => { globalThis.__capture = event.detail.capture }, { once: true })
        })
        await setupRace.locator('[data-run]').click()
        await setupRace.waitForFunction(() => typeof globalThis.__releaseCapture === 'function')
        await setupRace.setViewportSize({ width: 375, height: 812 })
        await setupRace.locator('.hero-signal').waitFor({ state: 'hidden' })
        await setupRace.evaluate(() => globalThis.__releaseCapture())
        await setupRace.waitForFunction(() => !document.querySelector('[data-run]').hasAttribute('aria-busy'))
        assert.equal(await setupRace.evaluate(async () => (await globalThis.__capture) === null), true, 'hiding during hero setup creates no capture node')
        assert.equal(await setupRace.locator('.hero-play-status').textContent(), '', 'hiding during hero setup is not a visualization error')
        assert.equal(await setupRace.locator('.hero-signal').isVisible(), false)
        await setupRace.locator('[data-run]').click()
      } finally { await setupRace.close() }
      // A delayed graph import and source fetch must not overwrite a replacement
      // example, whether the old response succeeds or fails.
      for (const responseStatus of [200, 404]) {
        const race = await browser.newPage()
        const pending = []
        try {
          await race.route('**/examples/graphs/sweep.js', route => { pending.push(route) })
          await race.goto(url)
          await race.locator('[data-open-example="sweep"]').click()
          await race.locator('.code-tab[data-pane="code"]').click()
          await race.waitForFunction(() => document.querySelector('.code-tab[data-pane="code"]').getAttribute('aria-pressed') === 'true')
          for (let i = 0; pending.length < 2 && i < 40; i++) await race.waitForTimeout(50)
          assert.equal(pending.length, 2, 'both A import and A source fetch are held')
          await race.evaluate(() => document.querySelector('[data-open-example="noise"]').click())
          await race.waitForFunction(() => document.querySelector('#graph-pane svg')?.getAttribute('aria-label').includes('noise'))
          await race.locator('.code-tab[data-pane="code"]').click()
          const source = await readFile(resolve(root, 'examples/graphs/noise.js'), 'utf8')
          await race.waitForFunction(source => document.querySelector('#example-code').textContent === source, source)
          const graph = await race.locator('#graph-pane').innerHTML()
          for (const route of pending.splice(0)) await route.fulfill({ status: responseStatus, contentType: 'text/javascript', body: await readFile(resolve(root, 'examples/graphs/sweep.js'), 'utf8') })
          await race.waitForTimeout(200)
          assert.equal(await race.locator('#example-code').textContent(), source, `A → B (${responseStatus}): stale source cannot replace B`)
          assert.equal(await race.locator('#graph-pane').innerHTML(), graph, `A → B (${responseStatus}): stale graph cannot replace B`)
        } finally {
          for (const route of pending) await route.abort().catch(() => {})
          await race.close()
        }
      }
      await page.setViewportSize({ width: 1024, height: 900 })
      await page.locator('[data-run]').click()
      await page.waitForTimeout(600)
      assert.equal(await page.locator('.hero-play-status').textContent(), '')
      assert.ok((await page.locator('.wave-peak').getAttribute('d')).length > 100, 'hero captures live sound')
      await page.locator('[data-run]').click()

      // Sample capture must survive a display stall and reduced-motion painting.
      await page.emulateMedia({ reducedMotion: 'reduce' })
      const result = await page.evaluate(async () => {
        const { observeSignal } = await import('/assets/signal.js')
        const ctx = new globalThis.AudioContext()
        await ctx.resume()
        const source = ctx.createBufferSource()
        source.buffer = ctx.createBuffer(1, 4800, ctx.sampleRate)
        source.buffer.getChannelData(0)[1] = 0.75
        const capture = await observeSignal(ctx, source)
        if (!capture) throw Error('Capture unavailable')
        source.start(ctx.currentTime + 0.05)
        const until = performance.now() + 300
        while (performance.now() < until) {} // intentionally block display and message handling
        await new Promise(resolve => setTimeout(resolve, 200))
        const peak = Math.max(...capture.history.frames.map(f => f.peak))
        capture.dispose(); capture.dispose()
        const levels = []
        for (const value of [0.25, 0.25, -0.5, 0]) {
          const source = ctx.createBufferSource()
          source.buffer = ctx.createBuffer(1, 4096, ctx.sampleRate)
          source.buffer.getChannelData(0).fill(value)
          const next = await observeSignal(ctx, source)
          source.start()
          await new Promise(resolve => setTimeout(resolve, 150))
          levels.push(Math.max(...next.history.frames.map(f => f.rms)))
          next.dispose()
        }
        const leakedNodes = Object.hasOwn(ctx, 'nodes')
        await ctx.close()
        const { AudioContext: HeroContext } = await import('/assets/hero-context.js')
        const hero = new HeroContext()
        await hero.resume()
        hero.createGain().connect(hero.destination)
        const held = hero.nodes.size
        await hero.close()
        return { peak, levels, leakedNodes, held, retained: hero.nodes.size }
      })
      assert.equal(result.peak, 0.75, 'an impulse between slow display frames is retained')
      assert.deepEqual(result.levels, [0.25, 0.25, 0.5, 0], 'A → A → B → silence has the expected RMS')
      assert.equal(result.leakedNodes, false, 'ordinary contexts do not retain graph nodes through the hero shim')
      assert.ok(result.held > 0, 'feedback retention is scoped to the hero')
      assert.equal(result.retained, 0, 'hero close releases retained nodes')

      await page.locator('[data-open-example="metronome"]').click()
      await page.locator('#demo-run').click()
      await page.waitForTimeout(1100)
      const nonempty = () => page.locator('#demo-canvas').evaluate(canvas => {
        const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
        let count = 0
        for (let i = 3; i < data.length; i += 4) if (data[i]) count++
        return count > canvas.width
      })
      assert.ok(await nonempty(), 'demo has waveform history')
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.waitForTimeout(200)
      assert.ok(await nonempty(), 'resizing does not clear live history')
      await page.locator('#demo-run').click()
      await page.setViewportSize({ width: 1024, height: 900 })
      await page.waitForTimeout(200)
      assert.ok(await nonempty(), 'resizing retains the stopped history')
      await page.locator('[data-close-dialog]').click()
      // Dispose A while resume/permissions are pending, mount B into the same DOM,
      // then release A. Neither audio resources nor stale UI may survive.
      const lifecycle = await page.evaluate(async () => {
        const { mountExample } = await import('/examples/browser.js')
        const root = document.querySelector('#example-dialog').cloneNode(true)
        root.id = 'lifecycle-test'
        document.body.append(root); root.showModal()
        const NativeContext = globalThis.AudioContext
        const getUserMedia = navigator.mediaDevices.getUserMedia
        const contexts = []
        let release, hold = true, cleanup, stopped = 0
        globalThis.AudioContext = class extends NativeContext {
          constructor(...args) { super(...args); contexts.push(this); this.closures = [] }
          // WebKit can emit a stale running state after closing during startup.
          // Record the actual close completion before any later native events.
          async close() { await super.close(); this.closures.push(this.state) }
          async resume() {
            await super.resume()
            if (hold) await new Promise(resolve => { release = resolve })
          }
        }
        const pause = () => new Promise(resolve => setTimeout(resolve, 50))
        const snapshot = () => [root.querySelector('#demo-status').textContent, root.querySelector('#demo-run').getAttribute('aria-busy'), root.querySelector('#demo-run').dataset.state]
        try {
          cleanup = mountExample(root, 'tone')
          root.querySelector('#demo-run').click()
          for (let i = 0; i < 40 && !release; i++) await pause()
          if (!release) throw Error('Context did not resume')
          await cleanup()
          cleanup = mountExample(root, 'noise')
          const expected = snapshot()
          release(); await pause()
          const afterResume = snapshot()
          await cleanup()
          navigator.mediaDevices.getUserMedia = () => new Promise(resolve => { release = resolve })
          cleanup = mountExample(root, 'recorder')
          root.querySelector('#demo-run').click()
          await cleanup()
          cleanup = mountExample(root, 'noise')
          release({ getTracks: () => [{ stop() { stopped++ } }] })
          await pause()
          const afterPermission = snapshot(), afterPermissionContexts = contexts.length
          await cleanup()
          hold = false
          cleanup = mountExample(root, 'process-file')
          const transfer = new DataTransfer()
          transfer.items.add(new File([new Uint8Array([0])], 'broken.wav', { type: 'audio/wav' }))
          root.querySelector('#audio-file').files = transfer.files
          root.querySelector('#demo-run').click()
          for (let i = 0; i < 40 && root.querySelector('#demo-run').dataset.state !== 'error'; i++) await pause()
          return { expected, afterResume, afterPermission, stopped, afterPermissionContexts, closures: contexts.map(c => [...c.closures]), fileError: root.querySelector('#demo-run').dataset.state }
        } finally {
          await cleanup?.()
          for (const context of contexts) if (context.state !== 'closed') await context.close()
          globalThis.AudioContext = NativeContext
          navigator.mediaDevices.getUserMedia = getUserMedia
          root.remove()
        }
      })
      assert.deepEqual(lifecycle.afterResume, lifecycle.expected, 'late resume cannot overwrite replacement UI')
      assert.deepEqual(lifecycle.afterPermission, lifecycle.expected, 'late permission cannot overwrite replacement UI')
      assert.equal(lifecycle.stopped, 1, 'a late microphone grant is immediately stopped')
      assert.equal(lifecycle.afterPermissionContexts, 1, 'late permission does not create a new audio context')
      assert.equal(lifecycle.fileError, 'error', 'malformed WAV is reported')
      assert.deepEqual(lifecycle.closures, [['closed'], ['closed']], 'cancelled playback and failed decoding each await exactly one completed close')
      // Route ownership must not await an old device close. Exercise the actual
      // homepage router, not just mountExample's inner disposal guards.
      await page.evaluate(() => {
        const Native = globalThis.AudioContext
        const test = globalThis.__routeTest = { Native, contexts: [], releases: [], hold: true }
        globalThis.AudioContext = class extends Native {
          constructor(...args) { super(...args); test.contexts.push(this) }
          async close() {
            await super.close()
            if (test.hold) await new Promise(resolve => test.releases.push(resolve))
          }
        }
      })
      const routeSnapshot = () => page.evaluate(() => [document.querySelector('#dialog-title').textContent, location.pathname, document.querySelector('#demo-run').getAttribute('aria-label'), document.querySelector('#demo-status').textContent])
      try {
        await page.locator('[data-open-example="metronome"]').click()
        await page.locator('#demo-run').click()
        await page.waitForFunction(() => document.querySelector('#demo-run').dataset.state === 'running')
        await page.evaluate(() => {
          document.querySelector('[data-open-example="sweep"]').click()
          document.querySelector('[data-open-example="noise"]').click()
        })
        await page.waitForFunction(() => __routeTest.releases.length === 1 && location.pathname.endsWith('/noise/'))
        const expected = await routeSnapshot()
        await page.evaluate(() => __routeTest.releases.shift()())
        await page.waitForTimeout(100)
        assert.deepEqual(await routeSnapshot(), expected, 'A → B → C: delayed A close cannot remount B over C')
        await page.evaluate(() => {
          document.querySelector('[data-open-example="noise"]').click()
          document.querySelector('[data-open-example="noise"]').click()
        })
        await page.locator('#demo-run').click()
        await page.waitForFunction(() => document.querySelector('#demo-run').dataset.state === 'running')
        assert.equal(await page.evaluate(() => __routeTest.contexts.length), 2, 'A → A leaves exactly one active run listener')
        await page.evaluate(() => {
          document.querySelector('[data-open-example="sweep"]').click()
          document.querySelector('[data-close-dialog]').click()
        })
        await page.waitForFunction(() => __routeTest.releases.length === 1 && !document.querySelector('#example-dialog').open)
        await page.evaluate(() => __routeTest.releases.shift()())
        await page.waitForTimeout(100)
        assert.deepEqual(await page.evaluate(() => [document.querySelector('#example-dialog').open, location.pathname]), [false, '/'], 'close while switching cannot reopen a stale route')
        await page.evaluate(() => {
          document.querySelector('[data-open-example="noise"]').click()
          document.querySelector('[data-close-dialog]').click()
          document.querySelector('[data-open-example="metronome"]').click()
        })
        await page.waitForTimeout(100)
        assert.deepEqual(await page.evaluate(() => [document.querySelector('#example-dialog').open, location.pathname]), [true, '/examples/metronome/'], 'queued old close event cannot dispose a reopened dialog')
        await page.locator('#demo-run').click()
        await page.waitForFunction(() => document.querySelector('#demo-run').dataset.state === 'running')
        assert.equal(await page.evaluate(() => __routeTest.contexts.length), 3, 'reopened dialog still owns its run listener')
      } finally {
        await page.evaluate(async () => {
          const test = __routeTest
          test.hold = false
          for (const release of test.releases) release()
          document.querySelector('[data-close-dialog]').click()
          for (const context of test.contexts) if (context.state !== 'closed') await context.close()
          globalThis.AudioContext = test.Native
          delete globalThis.__routeTest
        })
      }
      assert.deepEqual(errors, [], 'no browser errors')
      console.log(`${engine.name()}: layout, playback, stalled capture, reduced motion, resize and stop passed`)
    } finally { await browser.close() }
  }
} finally { await new Promise(resolve => server.close(resolve)) }
