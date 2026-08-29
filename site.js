import { highlightSyntax } from './syntax.js'

function setButtonLabel(button, label) {
  let target = button.querySelector('span') || button
  target.textContent = label
}

async function copyText(button, text) {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text)
    else {
      let area = document.createElement('textarea')
      area.value = text
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.append(area)
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    let previous = button.querySelector('span')?.textContent || button.textContent
    button.dataset.state = 'copied'
    setButtonLabel(button, 'Copied')
    setTimeout(() => {
      delete button.dataset.state
      setButtonLabel(button, previous)
    }, 2200)
  } catch {
    button.classList.add('is-error')
    setButtonLabel(button, 'Copy failed')
    setTimeout(() => {
      button.classList.remove('is-error')
      setButtonLabel(button, 'Copy')
    }, 2200)
  }
}

for (let button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', () => {
    let target = document.querySelector(button.dataset.copy)
    let text = target?.textContent?.trim() || ''
    if (button.dataset.copy === '#install-command') text = text.replace(/^\$\s*/, '')
    copyText(button, text)
  })
}

for (let link of document.querySelectorAll('.mobile-nav nav a')) {
  link.addEventListener('click', () => link.closest('details')?.removeAttribute('open'))
}

highlightSyntax().catch(() => {})
