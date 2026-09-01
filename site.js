import { byId } from './examples/catalog.js'
import { mountExample } from './examples/browser.js'

const dialog = document.getElementById('example-dialog')
const title = document.getElementById('dialog-title')
const meta = document.getElementById('dialog-meta')
const description = document.getElementById('dialog-description')
let dispose = null
let activeId = null
const unlockPage = () => document.documentElement.classList.remove('modal-open')

async function openExample(id, updateHistory = true) {
  let example = byId.get(id)
  if (!example) return
  if (dispose) await dispose()
  activeId = id
  title.textContent = example.title
  meta.replaceChildren(...[example.category, example.job].map(value => {
    let tag = document.createElement('span')
    tag.textContent = value
    return tag
  }))
  description.textContent = example.description
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
    button.setAttribute('aria-pressed', String(tag === ''))
    button.addEventListener('click', () => apply(tag))
    return button
  }
  let tags = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a))
  filters.append(makeButton(''), ...tags.map(makeButton))
}

let strips = document.querySelector('.install-strips')
if (strips) {
  let context = strips.getContext('2d')
  let paint = () => {
    let ratio = Math.min(devicePixelRatio || 1, 2)
    let width = strips.offsetWidth * ratio, height = strips.offsetHeight * ratio
    if (width < 1) return
    if (strips.width !== width || strips.height !== height) { strips.width = width; strips.height = height }
    // equal-width cells, each split black/transparent; the split ratio eases in-out
    let cells = 10
    let cell = width / cells
    let ease = t => t < 0.5 ? 2 * t * t : 1 - (2 - 2 * t) ** 2 / 2
    context.clearRect(0, 0, width, height)
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-ink').trim()
    for (let k = 0; k < cells; k++) {
      let black = 1 - ease(k / (cells - 1))
      context.fillRect(k * cell, 0, Math.max(1, cell * black), height)
    }
  }
  paint()
  addEventListener('resize', paint)
}
