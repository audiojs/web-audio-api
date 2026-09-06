import { byId } from './examples/catalog.js'
import { plotsVisible } from './assets/signal.js'
import { highlight, mountExample, remember } from './examples/browser.js'

const dialog = document.getElementById('example-dialog')
const title = document.getElementById('dialog-title')
const description = document.getElementById('dialog-description')
let dispose = null
let activeId = null
const unlockPage = () => document.documentElement.classList.remove('modal-open')
// while the modal is open the address is the example's own page, so the link shares as that page
const homeURL = new URL('./', location.href)

// The hero file runs here unchanged: the import map hands it the page's own Web
// Audio, whose constructor announces each context so the button can follow it.
// the hero plays at whatever level the panel's slider is set to, kept across sessions
const volume = document.getElementById('hero-volume')
let heard = null
remember(volume, 'hero-volume')
volume?.addEventListener('input', () => { if (heard?.level) heard.level.gain.value = Number(volume.value) / 100 })

for (let button of document.querySelectorAll('[data-run]')) {
  let playing = null, starting = false
  button.addEventListener('click', async () => {
    if (starting) return
    // a context already closing rejects a second close, which is the outcome wanted anyway
    if (playing) return playing.close().catch(() => {})
    starting = true
    button.dataset.state = 'running'
    const status = document.querySelector('.hero-play-status')
    status.textContent = ''
    button.setAttribute('aria-busy', 'true')
    try {
      await import(`${button.dataset.run}?${Date.now()}`)
      button.setAttribute('aria-label', 'Stop preview')
    } catch {
      await playing?.close().catch(() => {})
      delete button.dataset.state
      status.textContent = 'Audio could not start. Tap play to try again.'
    } finally { starting = false; button.removeAttribute('aria-busy') }
  })
  addEventListener('audiocontext', ({ detail: context }) => {
    if (!starting) return
    playing?.close().catch(() => {})
    playing = context
    heard = context
    if (context.level) context.level.gain.value = Number(volume?.value ?? 60) / 100
    follow(context)
    context.addEventListener('statechange', () => {
      if (context.state !== 'closed' || playing !== context) return
      playing = null
      button.setAttribute('aria-label', 'Play preview')
      delete button.dataset.state
    })
  })
}

// While the hero file plays, the panel beside its code follows the analyser the
// page-side context taps its output through: a rolling envelope and the live
// spectrum in the same bars, on absolute dBFS scales so silence draws silence.
// When the context closes the panel keeps its last frame.
const signal = document.querySelector('.hero-signal')
let followed = null
async function follow(context) {
  if (!signal || !plotsVisible()) return
  followed = context
  const capture = await context.capture
  if (followed !== context || context.state === 'closed' || !plotsVisible()) return
  if (!capture) {
    document.querySelector('.hero-play-status').textContent = 'Live visualization unavailable in this browser.'
    return
  }
  const peakPath = signal.querySelector('.wave-peak'), rmsPath = signal.querySelector('.wave-rms')
  const spectrumPath = signal.querySelector('.hero-spectrum path')
  const bins = new Float32Array(100)
  const bar = (i, amplitude) => {
    const level = amplitude > 0 ? Math.max(0, 1 + 20 * Math.log10(amplitude) / 48) : 0
    const half = Math.max(0.5, level * 106)
    return `M${2 + i * 4} ${(110 - half).toFixed(1)}V${(110 + half).toFixed(1)}`
  }
  const axis = signal.querySelectorAll('.art-row')[1]
  axis.firstElementChild.textContent = '−3 s'
  axis.lastElementChild.textContent = 'now'
  let version = -1
  const frame = () => {
    if (followed !== context || context.state === 'closed') return
    if (!plotsVisible()) { setTimeout(frame, 160); return }
    const history = capture.history
    if (version !== history.version) {
      version = history.version
      const columns = history.columns(100, 3)
      peakPath.setAttribute('d', columns.map((v, i) => v ? bar(i, v.peak) : '').join(''))
      rmsPath.setAttribute('d', columns.map((v, i) => v ? bar(i, v.rms) : '').join(''))
      const latest = history.frames.at(-1)
      bins.fill(0)
      if (latest) for (let bin = 1; bin < latest.spectrum.length; bin++) {
        const frequency = bin * context.sampleRate / (latest.spectrum.length * 2)
        const k = Math.floor(Math.log(frequency / 40) / Math.log(16000 / 40) * bins.length)
        if (k >= 0 && k < bins.length) bins[k] = Math.max(bins[k], latest.spectrum[bin] / 255)
      }
      spectrumPath.setAttribute('d', Array.from(bins, (v, i) => `M${2 + i * 4} 220V${(220 - Math.max(1, v * 106)).toFixed(1)}`).join(''))
    }
    setTimeout(frame, matchMedia('(prefers-reduced-motion: reduce)').matches ? 160 : 1000 / 30)
  }
  frame()
}

// Each runtime mark explains itself: its tip opens above the mark, or below when the top of the
// viewport is too close, after a moment of hover and at once on focus or click; a click or tap pins it,
// Escape or a press elsewhere closes it. One tip at a time, and while one is open or just closed the
// next mark opens without the wait. The popover rides the top layer, placed in document coordinates
// so it scrolls with its mark.
const TIP_DELAY = 600
let openTip = null, warmUntil = 0
const placeTip = () => {
  if (!openTip) return
  let { mark, tip } = openTip, rect = mark.getBoundingClientRect(), above = rect.top - tip.offsetHeight - 8
  tip.style.left = `${scrollX + Math.max(16, Math.min(rect.left, innerWidth - tip.offsetWidth - 16))}px`
  tip.style.top = `${scrollY + (above >= 8 ? above : rect.bottom + 8)}px`
}
const closeTip = () => { openTip?.tip.hidePopover(); openTip = null; warmUntil = performance.now() + TIP_DELAY }
for (let mark of document.querySelectorAll('.hero-stack button[aria-describedby]')) {
  let tip = document.getElementById(mark.getAttribute('aria-describedby'))
  if (!tip?.showPopover) continue
  let wait = 0
  let show = pinned => {
    clearTimeout(wait)
    if (openTip && openTip.tip !== tip) closeTip()
    if (!tip.matches(':popover-open')) tip.showPopover()
    openTip = { mark, tip, pinned: pinned || Boolean(openTip?.pinned) }
    placeTip()
  }
  let rest = () => { clearTimeout(wait); if (openTip?.tip === tip && !openTip.pinned) closeTip() }
  mark.addEventListener('click', () => openTip?.tip === tip && openTip.pinned ? closeTip() : show(true))
  mark.addEventListener('focus', () => show(false))
  mark.addEventListener('blur', rest)
  mark.addEventListener('pointerenter', () => { wait = setTimeout(() => show(false), openTip || performance.now() < warmUntil ? 0 : TIP_DELAY) })
  mark.addEventListener('pointerleave', rest)
}
// wider than the phone it is read on: the graph opens centred, not against its left edge
const art = document.querySelector('.hero-art .graph-scroll')
if (art) {
  let centre = () => { art.scrollLeft = (art.scrollWidth - art.clientWidth) / 2 }
  centre()
  addEventListener('resize', centre)
  addEventListener('load', centre)
}

addEventListener('pointerdown', event => { if (openTip && !event.target.closest('.hero-stack')) closeTip() })
addEventListener('keydown', event => { if (event.key === 'Escape' && openTip) closeTip() })
addEventListener('resize', placeTip)

highlight()

// Highlighting is one registry for the whole page; whenever the modal loads
// source, highlight the page again so the hero keeps its colors.
const exampleCode = document.getElementById('example-code')
if (exampleCode) new MutationObserver(() => highlight()).observe(exampleCode, { childList: true, characterData: true, subtree: true })

function openExample(id, updateHistory = true) {
  let example = byId.get(id)
  if (!example) return
  // Disposal relinquishes DOM ownership synchronously; device close may finish later.
  dispose?.()
  activeId = id
  title.textContent = example.title
  description.textContent = example.description
  dispose = mountExample(dialog, id)
  if (!dialog.open) {
    document.documentElement.classList.add('modal-open')
    dialog.showModal()
  }
  if (updateHistory) history.replaceState(null, '', new URL(`examples/${id}/`, homeURL))
  requestAnimationFrame(() => dialog.querySelector('#demo-fields input, #demo-fields select, #demo-run')?.focus({ preventScroll: true }))
}

for (let link of document.querySelectorAll('[data-open-example]')) {
  link.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    openExample(link.dataset.openExample)
  })
}

const closeDialog = () => {
  if (!dialog.open) return
  unlockPage()
  dialog.close()
}

dialog.querySelector('[data-close-dialog]').addEventListener('click', closeDialog)
dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog() })
dialog.addEventListener('cancel', unlockPage)
addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !dialog.open) return
  event.preventDefault()
  closeDialog()
}, { capture: true })
dialog.addEventListener('close', () => {
  if (dialog.open) return // a queued close event from before an immediate reopen
  unlockPage()
  dispose?.()
  dispose = null
  activeId = null
  if (location.href !== homeURL.href) history.replaceState(null, '', homeURL)
  highlight()
})

addEventListener('hashchange', () => {
  let id = decodeURIComponent(location.hash.slice(1))
  if (id && id !== activeId) openExample(id, false)
  else if (!id) closeDialog()
})

addEventListener('pagehide', () => dispose?.())

let initialId = decodeURIComponent(location.hash.slice(1))
if (byId.has(initialId)) openExample(initialId, false)


