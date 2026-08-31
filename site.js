import { byId } from './examples/catalog.js'
import { mountExample } from './examples/browser.js'

const dialog = document.getElementById('example-dialog')
const title = document.getElementById('dialog-title')
const meta = document.getElementById('dialog-meta')
const description = document.getElementById('dialog-description')
const command = document.getElementById('dialog-command')
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
  command.textContent = example.command
  dispose = mountExample(dialog, id)
  if (!dialog.open) {
    document.documentElement.classList.add('modal-open')
    dialog.showModal()
  }
  if (updateHistory) history.replaceState(null, '', `#${id}`)
  requestAnimationFrame(() => dialog.querySelector('input, select, #demo-run')?.focus({ preventScroll: true }))
}

for (let link of document.querySelectorAll('[data-open-example]')) {
  link.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    openExample(link.dataset.openExample)
  })
}

dialog.querySelector('[data-close-dialog]').addEventListener('click', () => { unlockPage(); dialog.close() })
dialog.addEventListener('click', event => { if (event.target === dialog) { unlockPage(); dialog.close() } })
dialog.addEventListener('cancel', unlockPage)
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
  else if (!id && dialog.open) { unlockPage(); dialog.close() }
})

addEventListener('pagehide', () => dispose?.())

let initialId = decodeURIComponent(location.hash.slice(1))
if (byId.has(initialId)) openExample(initialId, false)
