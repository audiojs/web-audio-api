import { byId } from './examples/catalog.js'
import { highlight, mountExample } from './examples/browser.js'

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
for (let button of document.querySelectorAll('[data-run]')) {
  let playing = null, starting = false
  button.addEventListener('click', async () => {
    if (starting) return
    // a context already closing rejects a second close, which is the outcome wanted anyway
    if (playing) return playing.close().catch(() => {})
    starting = true
    button.dataset.state = 'playing'
    try { await import(`${button.dataset.run}?${Date.now()}`) } catch { delete button.dataset.state } finally { starting = false }
  })
  addEventListener('audiocontext', ({ detail: context }) => {
    if (!starting) return
    playing?.close().catch(() => {})
    playing = context
    follow(context)
    context.addEventListener('statechange', () => {
      if (context.state !== 'closed' || playing !== context) return
      playing = null
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
function follow(context) {
  let tap = context.tap
  if (!signal || !tap) return
  followed = context
  let peakPath = signal.querySelector('.wave-peak'), rmsPath = signal.querySelector('.wave-rms')
  let spectrumPath = signal.querySelector('.hero-spectrum path')
  let samples = new Float32Array(tap.fftSize), decibels = new Float32Array(tap.frequencyBinCount)
  let peaks = new Float32Array(100), levels = new Float32Array(100), bins = new Float32Array(100)
  let bar = (i, half) => `M${2 + i * 4} ${(110 - half).toFixed(1)}V${(110 + half).toFixed(1)}`
  let binOf = f => Math.floor(Math.log(f / 40) / Math.log(16000 / 40) * bins.length)
  // 48 dB of level under full scale, as the catalogue draws it; 80 dB of spectrum under -10 dBFS
  let level = amplitude => amplitude > 0 ? Math.max(0, 1 + 20 * Math.log10(amplitude) / 48) : 0
  let strength = dB => Math.min(1, Math.max(0, (dB + 90) / 80))
  // the envelope spans three seconds whatever the frame rate: one bin per 30 ms of clock
  let step = 3000 / peaks.length, last = performance.now()
  let frame = now => {
    if (followed !== context || context.state === 'closed') return
    tap.getFloatTimeDomainData(samples)
    let peak = 0, energy = 0
    for (let value of samples) { peak = Math.max(peak, Math.abs(value)); energy += value * value }
    for (; now - last >= step; last += step) {
      peaks.copyWithin(0, 1); levels.copyWithin(0, 1)
      peaks[peaks.length - 1] = peak; levels[levels.length - 1] = Math.sqrt(energy / samples.length)
    }
    peakPath.setAttribute('d', Array.from(peaks, (v, i) => bar(i, Math.max(0.5, level(v) * 106))).join(''))
    rmsPath.setAttribute('d', Array.from(levels, (v, i) => bar(i, Math.max(0.5, level(v) * 106))).join(''))
    tap.getFloatFrequencyData(decibels)
    bins.fill(-Infinity)
    for (let bin = 1; bin < decibels.length; bin++) {
      let k = binOf(bin * context.sampleRate / tap.fftSize)
      if (k >= 0 && k < bins.length) bins[k] = Math.max(bins[k], decibels[bin])
    }
    spectrumPath.setAttribute('d', Array.from(bins, (dB, i) => `M${2 + i * 4} 220V${(220 - Math.max(1, strength(dB) * 106)).toFixed(1)}`).join(''))
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
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
for (let mark of document.querySelectorAll('.hero-stack > button[aria-describedby]')) {
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
// The row of runtimes stays on one line whatever the width: while the last mark reaches past the
// row's edge, labels drop one by one from the end. A dropped label still names its mark to a screen
// reader and to its tip. Without this script the marks wrap instead.
const stack = document.querySelector('.hero-stack')
let marks = [...stack?.querySelectorAll('button') || []]
if (marks.length) {
  let overflows = () => marks.at(-1).getBoundingClientRect().right > stack.getBoundingClientRect().right + 0.5
  let fit = () => {
    for (let mark of marks) mark.classList.remove('is-compact')
    for (let i = marks.length - 1; i >= 0 && overflows(); i--) marks[i].classList.add('is-compact')
  }
  stack.classList.add('is-fitted')
  fit()
  // a scroll that slides a phone's address bar away fires resize without changing the row's width
  let width = stack.getBoundingClientRect().width
  new ResizeObserver(([entry]) => {
    if (entry.contentRect.width === width) return
    width = entry.contentRect.width
    fit()
  }).observe(stack)
  document.fonts?.ready.then(fit)
}

addEventListener('pointerdown', event => { if (openTip && !event.target.closest('.hero-stack')) closeTip() })
addEventListener('keydown', event => { if (event.key === 'Escape' && openTip) closeTip() })
addEventListener('resize', placeTip)

highlight()

// Highlighting is one registry for the whole page; whenever the modal loads
// source, highlight the page again so the hero keeps its colors.
const exampleCode = document.getElementById('example-code')
if (exampleCode) new MutationObserver(() => highlight()).observe(exampleCode, { childList: true, characterData: true, subtree: true })

async function openExample(id, updateHistory = true) {
  let example = byId.get(id)
  if (!example) return
  if (dispose) await dispose()
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
dialog.addEventListener('close', async () => {
  unlockPage()
  if (dispose) await dispose()
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


