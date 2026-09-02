import { byId } from './examples/catalog.js'
import { controlsFor } from './examples/options.js'
import { mountExample, stripBand } from './examples/browser.js'
import { collapseGraph, graphSVG, recordConnections, resolveGraph } from './graph.js'
import { highlightSyntax } from './syntax.js'

const dialog = document.getElementById('example-dialog')
const title = document.getElementById('dialog-title')
const description = document.getElementById('dialog-description')
let dispose = null
let activeId = null
const unlockPage = () => document.documentElement.classList.remove('modal-open')

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
  let peaks = new Float32Array(200), levels = new Float32Array(200), bins = new Float32Array(100)
  let bar = (i, half) => `M${1 + i * 2} ${(110 - half).toFixed(1)}V${(110 + half).toFixed(1)}`
  let binOf = f => Math.floor(Math.log(f / 40) / Math.log(16000 / 40) * bins.length)
  // 48 dB of level under full scale, as the catalogue draws it; 80 dB of spectrum under -10 dBFS
  let level = amplitude => amplitude > 0 ? Math.max(0, 1 + 20 * Math.log10(amplitude) / 48) : 0
  let strength = dB => Math.min(1, Math.max(0, (dB + 90) / 80))
  // the envelope spans three seconds whatever the frame rate: one bin per 15 ms of clock
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
    spectrumPath.setAttribute('d', Array.from(bins, (dB, i) => `M${2 + i * 4} 64V${(64 - Math.max(0.5, strength(dB) * 62)).toFixed(1)}`).join(''))
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

// The highlighter files every member access under one category; a member that
// is called is a method, so it gets its own.
function splitMethods() {
  let properties = CSS.highlights?.get('property')
  if (!properties) return
  let methods = new Highlight()
  for (let range of [...properties]) {
    let node = range.endContainer
    if (node.nodeType === Node.TEXT_NODE && node.data[range.endOffset] === '(') {
      properties.delete(range)
      methods.add(range)
    }
  }
  CSS.highlights.set('method', methods)
}
const highlight = () => highlightSyntax().then(splitMethods).catch(() => {})
highlight()

// Highlighting is one registry for the whole page; whenever the modal loads
// source, highlight the page again so the hero keeps its colors.
const codePane = document.getElementById('code-pane')
const exampleCode = document.getElementById('example-code')
if (codePane && exampleCode) {
  new MutationObserver(() => {
    let lines = exampleCode.textContent.split('\n').length
    let gutter = codePane.querySelector('.lines') || codePane.insertBefore(document.createElement('span'), exampleCode)
    gutter.className = 'lines'
    gutter.setAttribute('aria-hidden', 'true')
    gutter.textContent = Array.from({ length: lines }, (_, i) => String(i + 1).padStart(2, '0')).join('\n')
    highlight()
  }).observe(exampleCode, { childList: true, characterData: true, subtree: true })
}

// The graph tab: run the example's graph module against an offline context with
// its default options, record what it connects, and draw it at its own size,
// zoomable with a pinch (or ctrl and the wheel).
const graphPane = document.getElementById('graph-pane')
let zoom = 1
function zoomGraph(factor) {
  zoom = Math.min(3, Math.max(0.5, zoom * factor))
  let graph = graphPane.querySelector('.graph')
  if (graph) graph.style.width = `${graph.getAttribute('width') * zoom}px`
}
graphPane?.addEventListener('wheel', event => {
  if (!event.ctrlKey) return
  event.preventDefault()
  zoomGraph(event.deltaY < 0 ? 1.1 : 0.9)
}, { passive: false })
async function showGraph(id) {
  if (!graphPane) return
  graphPane.innerHTML = '<p class="graph-note">Recording the graph…</p>'
  try {
    let { init } = await import(`./examples/graphs/${id}.js`)
    let options = Object.fromEntries(controlsFor(id).map(control => [control.key, control.browserValue ?? control.value]))
    let context = new OfflineAudioContext(2, 128, 44100)
    let edges = await recordConnections(AudioNode.prototype, () => init(context, { ...options, AudioWorkletNodeClass: AudioWorkletNode }))
    let resolved = resolveGraph(edges)
    if (!resolved.nodes.length) { graphPane.innerHTML = '<p class="graph-note">This example connects nothing until it runs.</p>'; return }
    let { nodes, edges: merged, counts } = collapseGraph(resolved.nodes, resolved.edges)
    graphPane.innerHTML = graphSVG(nodes, merged, `The graph ${id} connects`, counts)
    zoomGraph(1)
  } catch (error) {
    graphPane.innerHTML = `<p class="graph-note">This graph needs a live input, so it cannot be recorded here. ${error.message}</p>`
  }
}

for (let tab of dialog?.querySelectorAll('.code-tab') || []) {
  tab.addEventListener('click', () => {
    if (!graphPane) return
    graphPane.hidden = tab.dataset.pane !== 'graph'
    if (!graphPane.hidden && activeId) showGraph(activeId)
  })
}

async function openExample(id, updateHistory = true) {
  let example = byId.get(id)
  if (!example) return
  if (dispose) await dispose()
  activeId = id
  title.textContent = example.title
  description.textContent = example.description
  if (graphPane) graphPane.hidden = true
  dispose = mountExample(dialog, id)
  if (!dialog.open) {
    document.documentElement.classList.add('modal-open')
    dialog.showModal()
  }
  if (updateHistory) history.replaceState(null, '', `#${id}`)
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
  if (location.hash) history.replaceState(null, '', `${location.pathname}${location.search}`)
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

let filters = document.getElementById('example-filters')
if (filters) {
  let tagOf = entry => entry.querySelector('.example-tag')?.textContent.trim() || ''
  let counts = new Map()
  for (let entry of document.querySelectorAll('.example-entry')) {
    let tag = tagOf(entry)
    if (tag) counts.set(tag, (counts.get(tag) || 0) + 1)
  }
  let apply = active => {
    for (let button of filters.querySelectorAll('button'))
      button.setAttribute('aria-pressed', String(button.dataset.tag === active))
    for (let group of document.querySelectorAll('.example-group')) {
      let visible = 0
      for (let entry of group.querySelectorAll('.example-entry')) {
        let match = !active || tagOf(entry) === active
        entry.hidden = !match
        visible += match
      }
      group.hidden = !visible
    }
  }
  let makeButton = tag => {
    let button = document.createElement('button')
    button.type = 'button'
    button.dataset.tag = tag
    button.textContent = tag || 'All'
    let count = document.createElement('span')
    count.className = 'filter-count'
    count.textContent = tag ? counts.get(tag) : document.querySelectorAll('.example-entry').length
    button.append(count)
    button.setAttribute('aria-pressed', String(tag === ''))
    button.addEventListener('click', () => apply(tag))
    return button
  }
  let tags = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a))
  filters.append(makeButton(''), ...tags.map(makeButton))
}


// the white examples field opens where the code block ends, snapped to the
// 16px dot grid; the stripe band dissolves the dots into it just above
let examples = document.querySelector('.examples')
let fieldStrips = document.querySelector('.field-strips')
if (examples) {
  let snap = () => {
    let block = document.querySelector('.hero-code')
    let edge = Math.round((block.getBoundingClientRect().bottom + scrollY) / 16) * 16
    let top = examples.getBoundingClientRect().top + scrollY
    examples.style.setProperty('--grid-stop', `${top - edge}px`)
    if (fieldStrips) fieldStrips.style.insetBlockStart = `${edge - fieldStrips.offsetHeight}px`
  }
  snap()
  addEventListener('resize', snap)
  addEventListener('load', snap)
}
if (fieldStrips) stripBand(fieldStrips, false, '--color-white')
