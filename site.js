import { byId } from './examples/catalog.js'
import { mountExample, stripBand } from './examples/browser.js'

const dialog = document.getElementById('example-dialog')
const title = document.getElementById('dialog-title')
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

