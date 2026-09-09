import { byId } from './catalog.js'
import { observeSignal, plotsVisible } from '../assets/signal.js'
import { renderAudio } from '../assets/render.js'
import { controlsFor, optionsFor } from './options.js'
import { highlightSyntax } from '../syntax.js'
import { collapseGraph, graphSVG, recordConnections, resolveGraph } from '../graph.js'
import { init as buildWorklet } from './graphs/worklet.js'

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
const colours = new Map()
const css = name => {
  if (!colours.has(name)) colours.set(name, getComputedStyle(document.documentElement).getPropertyValue(name).trim())
  return colours.get(name)
}

function stopGraph(graph, time = 0) {
  if (!graph) return
  for (let source of graph.sources || []) {
    try { source.stop(time) } catch { continue }
  }
  for (let node of graph.nodes || []) {
    try { node.disconnect() } catch { continue }
  }
}

function setButtonLabel(button, label) {
  let target = button?.querySelector('span') || button
  if (target) target.textContent = label
  // Iconic buttons hide the span visually; the label still names the control
  if (button?.classList?.contains('is-iconic')) button.setAttribute('aria-label', label)
}

// a control that keeps its setting across sessions
export function remember(input, key) {
  if (!input || input.dataset.remembered) return
  input.dataset.remembered = key
  try {
    // a range clamps what it is given; a select must be offered the value
    let stored = localStorage.getItem(key)
    if (stored !== null && (!input.options || [...input.options].some(option => option.value === stored))) input.value = stored
  } catch { return }
  input.addEventListener('change', () => { try { localStorage.setItem(key, input.value) } catch { return } })
}

async function copyText(button, text) {
  let iconOnly = button.classList.contains('copy-icon')
  let previous = iconOnly ? button.getAttribute('aria-label') : button.querySelector('span')?.textContent || button.textContent
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
    button.dataset.state = 'copied'
    if (iconOnly) button.setAttribute('aria-label', 'Copied')
    else setButtonLabel(button, 'Copied')
    setTimeout(() => {
      delete button.dataset.state
      if (iconOnly) button.setAttribute('aria-label', previous)
      else setButtonLabel(button, previous)
    }, 2200)
  } catch {
    button.classList.add('is-error')
    if (iconOnly) button.setAttribute('aria-label', 'Copy failed')
    else setButtonLabel(button, 'Copy failed')
    setTimeout(() => {
      button.classList.remove('is-error')
      if (iconOnly) button.setAttribute('aria-label', previous)
      else setButtonLabel(button, previous)
    }, 2200)
  }
}

for (let button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', () => {
    let target = document.querySelector(button.dataset.copy)
    copyText(button, target?.textContent?.trim() || '')
  })
}


const controlSpecs = Object.fromEntries([...byId.keys()].map(id => [id, controlsFor(id)]))

function createControls(id, container) {
  let specs = controlSpecs[id] || []
  for (let spec of specs) {
    let label = document.createElement('label')
    let initialValue = spec.value
    label.className = 'control-field'
    let heading = document.createElement('span')
    let name = document.createElement('span')
    name.textContent = spec.label
    // the name keeps to one line, so the whole of it waits under the pointer
    heading.title = spec.label
    heading.append(name)
    let format = value => {
      if (spec.unit === 's' && Number(value) >= 120) {
        let minutes = Number(value) / 60
        return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)} min`
      }
      return `${value}${spec.unit ? ` ${spec.unit}` : ''}`
    }
    let output
    if (spec.type === 'range') {
      output = document.createElement('output')
      output.textContent = format(initialValue)
    }
    label.append(heading)
    let control
    if (spec.type === 'select') {
      control = document.createElement('select')
      for (let option of spec.choices) {
        let element = document.createElement('option')
        element.value = option
        element.textContent = option[0].toUpperCase() + option.slice(1)
        element.selected = option === initialValue
        control.append(element)
      }
    } else {
      control = document.createElement('input')
      control.type = spec.type
      if (spec.min != null) control.min = spec.min
      if (spec.max != null) control.max = spec.max
      if (spec.step != null) control.step = spec.step
      control.value = initialValue
      if (spec.pattern) control.pattern = spec.pattern
      if (spec.type === 'text') control.autocomplete = 'off'
    }
    control.name = spec.key
    control.id = `control-${spec.key}`
    if (output) control.addEventListener('input', () => { output.textContent = format(control.value) })
    label.htmlFor = control.id
    label.append(control)
    if (output) label.append(output)
    container.append(label)
  }
  // a control that follows another takes its value from that one's choice, until changed by hand
  for (let spec of specs) {
    if (!spec.follows) continue
    let control = container.querySelector(`#control-${spec.key}`), leader = container.querySelector(`#control-${spec.follows}`)
    if (!control || !leader) continue
    let apply = () => { control.value = spec.valueFor(leader.value); control.dispatchEvent(new Event('input')) }
    apply()
    leader.addEventListener('change', apply)
  }
}

function readOptions(id, container) {
  let options = {}
  for (let spec of controlSpecs[id] || []) {
    let input = container.elements[spec.key]
    options[spec.key] = spec.type === 'range' ? Number(input.value) : input.value
  }
  return options
}

// Compact surfaces use fewer backing pixels; phone signal plots are hidden entirely.
const phone = () => Math.min(innerWidth, innerHeight) < 500
const canvasRatio = () => Math.min(devicePixelRatio || 1, phone() ? 1 : 2)

function sizeCanvas(canvas) {
  // CSS transforms animate presentation, not the canvas's backing-store size.
  let ratio = canvasRatio()
  let width = Math.max(1, Math.round(canvas.clientWidth * ratio)), height = Math.max(1, Math.round(canvas.clientHeight * ratio))
  let changed = canvas.width !== width || canvas.height !== height
  if (changed) { canvas.width = width; canvas.height = height }
  return changed
}

// the level scale of the homepage panel: 48 dB under full scale
const level = amplitude => amplitude > 0 ? Math.max(0, 1 + 20 * Math.log10(amplitude) / 48) : 0

function peakOf(data, from = 0, to = data.length, stride = 1) {
  let peak = 0
  for (let index = from; index < to; index += stride) {
    let value = data[index] < 0 ? -data[index] : data[index]
    if (value > peak) peak = value
  }
  return peak
}

// a column of the envelope: the axis, and one bar out to what the frame peaked at
function drawEnvelopeColumn(ctx, x, step, height, peak, ink) {
  let mid = Math.round(height / 2), half = level(peak) * height * 0.46
  ctx.fillStyle = ink.axis
  ctx.fillRect(x, mid, step, 1)
  if (half < 0.5) return
  ctx.fillStyle = ink.accent
  ctx.fillRect(x, mid - half, step, half * 2)
}

const inkOf = () => ({ axis: css('--color-rule-dark'), accent: css('--color-accent') })

// the whole of a buffer as bars across the width; before anything plays there is only the axis
function drawWave(canvas, data = null) {
  if (!plotsVisible()) return
  sizeCanvas(canvas)
  let ctx = canvas.getContext('2d'), width = canvas.width, height = canvas.height, step = Math.max(2, Math.round(width / 200)), ink = inkOf()
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = ink.axis
  ctx.fillRect(0, Math.round(height / 2), width, 1)
  if (!data) return
  let columns = Math.floor(width / step)
  for (let k = 0; k < columns; k++) {
    drawEnvelopeColumn(ctx, k * step, step, height, peakOf(data, Math.floor(k / columns * data.length), Math.floor((k + 1) / columns * data.length)), ink)
  }
}

function frequencyAt(row, rows, sampleRate, scale) {
  let amount = 1 - row / Math.max(1, rows - 1)
  let nyquist = sampleRate / 2
  if (scale === 'linear') return amount * nyquist
  if (scale === 'mel') {
    let maxMel = 2595 * Math.log10(1 + nyquist / 700)
    return 700 * (10 ** (amount * maxMel / 2595) - 1)
  }
  let minimum = 20
  return minimum * (nyquist / minimum) ** amount
}

function resetSpectrogram(canvas) {
  if (!plotsVisible()) return
  sizeCanvas(canvas)
  let ctx = canvas.getContext('2d')
  ctx.globalAlpha = 1
  ctx.clearRect(0, 0, canvas.width, canvas.height)
}

// which analyser bin each row of the spectrogram reads, kept until the shape or the scale changes
let binRows = { key: '', rows: null }
function rowsFor(height, bins, sampleRate, scale) {
  let key = `${height}/${bins}/${sampleRate}/${scale}`
  if (binRows.key !== key) {
    let rows = new Uint16Array(height)
    for (let y = 0; y < height; y++)
      rows[y] = Math.min(bins - 1, Math.max(0, Math.round(frequencyAt(y, height, sampleRate, scale) / (sampleRate / 2) * (bins - 1))))
    binRows = { key, rows }
  }
  return binRows.rows
}

// One low-resolution image upload per paint; no canvas copies per audio block.
let raster = null
function signalRaster(columns, height, sampleRate, scale) {
  const width = columns.length
  if (!raster || raster.image.width !== width || raster.image.height !== height) {
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    const context = canvas.getContext('2d')
    context.fillStyle = css('--color-accent')
    context.fillRect(0, 0, 1, 1)
    raster = { canvas, context, image: context.createImageData(width, height), rgb: context.getImageData(0, 0, 1, 1).data.slice(0, 3) }
  }
  const { canvas, context, image, rgb } = raster
  image.data.fill(0)
  const rows = rowsFor(height, 1024, sampleRate, scale)
  for (let x = 0; x < width; x++) {
    if (!columns[x]) continue
    const data = columns[x].spectrum
    for (let y = 0; y < height; y++) {
      const amount = data[rows[y]] / 255, index = (y * width + x) * 4
      image.data[index] = rgb[0]; image.data[index + 1] = rgb[1]; image.data[index + 2] = rgb[2]
      image.data[index + 3] = amount * amount * 255
    }
  }
  context.putImageData(image, 0, 0)
  return canvas
}

function drawLiveSignal(canvas, spectrogram, history, scale) {
  if (!plotsVisible()) return
  sizeCanvas(canvas)
  sizeCanvas(spectrogram)
  // Every time cell has the same integer pixel width. Dividing the canvas into
  // 160 unequal rounded cells made a transient expand/contract as it moved left.
  const step = Math.max(1, Math.ceil(Math.ceil(canvas.clientWidth / 160) * canvasRatio()))
  const count = Math.ceil(canvas.width / step), offset = canvas.width - count * step
  const columns = history.columns(count)
  const wave = canvas.getContext('2d'), spectrum = spectrogram.getContext('2d')
  const ink = inkOf()
  wave.clearRect(0, 0, canvas.width, canvas.height)
  spectrum.clearRect(0, 0, spectrogram.width, spectrogram.height)
  // Missing capture data stays blank, rather than being presented as measured silence.
  for (let i = 0; i < count; i++) {
    const frame = columns[i]
    if (!frame) continue
    drawEnvelopeColumn(wave, offset + i * step, step, canvas.height, frame.peak, ink)
  }
  spectrum.imageSmoothingEnabled = false
  spectrum.drawImage(signalRaster(columns, Math.min(112, spectrogram.height), history.sampleRate, scale), offset, 0, count * step, spectrogram.height)
}

function drawBufferSpectrogram(canvas, data, sampleRate, scale) {
  if (!plotsVisible()) return
  resetSpectrogram(canvas)
  if (!data.length) return
  let width = canvas.width, height = canvas.height
  let columns = Math.min(160, Math.max(48, Math.floor(width / 4)))
  let rows = Math.min(96, Math.max(48, Math.floor(height / 2)))
  let scratch = document.createElement('canvas')
  scratch.width = columns; scratch.height = rows
  let ctx = scratch.getContext('2d')
  let windowSize = Math.min(256, data.length)
  let window = Float64Array.from({ length: windowSize }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / Math.max(1, windowSize - 1)))
  let coefficients = Float64Array.from({ length: rows }, (_, y) => 2 * Math.cos(2 * Math.PI * frequencyAt(y, rows, sampleRate, scale) / sampleRate))
  ctx.fillStyle = css('--color-accent')
  for (let x = 0; x < columns; x++) {
    let start = Math.floor(x / Math.max(1, columns - 1) * Math.max(0, data.length - windowSize))
    for (let y = 0; y < rows; y++) {
      let s1 = 0, s2 = 0, coefficient = coefficients[y]
      for (let i = 0; i < windowSize; i++) {
        let s0 = data[start + i] * window[i] + coefficient * s1 - s2
        s2 = s1; s1 = s0
      }
      let power = Math.max(1e-12, s1 * s1 + s2 * s2 - coefficient * s1 * s2)
      let db = 10 * Math.log10(power / (windowSize * windowSize))
      let amount = Math.max(0, Math.min(1, (db + 80) / 65))
      ctx.globalAlpha = amount * amount
      ctx.fillRect(x, y, 1, 1)
    }
  }
  ctx.globalAlpha = 1
  let output = canvas.getContext('2d')
  output.imageSmoothingEnabled = false
  output.drawImage(scratch, 0, 0, width, height)
}

function audioBufferToWav(buffer) {
  let channels = buffer.numberOfChannels, frames = buffer.length, bytes = frames * channels * 2
  let array = new ArrayBuffer(44 + bytes), view = new DataView(array), offset = 0
  let text = value => { for (let char of value) view.setUint8(offset++, char.charCodeAt(0)) }
  text('RIFF'); view.setUint32(offset, 36 + bytes, true); offset += 4; text('WAVE'); text('fmt ')
  view.setUint32(offset, 16, true); offset += 4; view.setUint16(offset, 1, true); offset += 2
  view.setUint16(offset, channels, true); offset += 2; view.setUint32(offset, buffer.sampleRate, true); offset += 4
  view.setUint32(offset, buffer.sampleRate * channels * 2, true); offset += 4
  view.setUint16(offset, channels * 2, true); offset += 2; view.setUint16(offset, 16, true); offset += 2
  text('data'); view.setUint32(offset, bytes, true); offset += 4
  let data = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel))
  for (let frame = 0; frame < frames; frame++) for (let channel = 0; channel < channels; channel++) {
    let sample = Math.max(-1, Math.min(1, data[channel][frame]))
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
    offset += 2
  }
  return new Blob([array], { type: 'audio/wav' })
}

function clearAudioResult(container) {
  const audio = container.querySelector('audio')
  if (audio) { audio.pause(); URL.revokeObjectURL(audio.src) }
  container.replaceChildren()
}

function setAudioResult(container, blob, filename, label) {
  clearAudioResult(container)
  let url = URL.createObjectURL(blob)
  let audio = document.createElement('audio')
  audio.controls = true
  audio.preload = 'metadata'
  audio.src = url
  audio.setAttribute('aria-label', label)
  let download = document.createElement('a')
  download.className = 'demo-download'
  download.href = url
  download.download = filename
  download.title = `Download ${filename}`
  download.setAttribute('aria-label', download.title)
  download.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5"/></svg>'
  container.append(audio, download)
}

function rms(data) {
  let sum = 0
  for (let value of data) sum += value * value
  return Math.sqrt(sum / data.length)
}

// the meter's own words: a level in decibels, or silence said out loud rather than as -120.0
function dbLabel(level) {
  let db = 20 * Math.log10(Math.max(level, 1e-6))
  return db <= -99 ? '-inf dB' : `${db.toFixed(1)} dB`
}

function detectPitch(data, sampleRate) {
  let level = rms(data)
  if (level < 0.012) return null
  let minLag = Math.floor(sampleRate / 1000), maxLag = Math.min(Math.floor(sampleRate / 55), data.length / 2)
  let bestLag = 0, best = 0
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0
    for (let i = 0; i < data.length - lag; i += 2) sum += data[i] * data[i + lag]
    if (sum > best) { best = sum; bestLag = lag }
  }
  return bestLag ? sampleRate / bestLag : null
}

function pitchLabel(frequency, a4 = 440) {
  if (!frequency) return 'Listening…'
  let midi = Math.round(69 + 12 * Math.log2(frequency / a4))
  let names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
  let note = `${names[(midi % 12 + 12) % 12]}${Math.floor(midi / 12) - 1}`
  let exact = a4 * 2 ** ((midi - 69) / 12)
  let cents = Math.round(1200 * Math.log2(frequency / exact))
  return `${note}, ${frequency.toFixed(1)} Hz, ${cents >= 0 ? '+' : ''}${cents} cents`
}

function createLevelMeter(fast) {
  let attack = fast ? 0.6 : 0.25, release = fast ? 0.35 : 0.06
  let rmsEnv = 1e-6, peakEnv = 1e-6
  let dbfs = value => 20 * Math.log10(Math.max(value, 1e-6))
  return samples => {
    let sum = 0, peak = 0
    for (let value of samples) { sum += value * value; peak = Math.max(peak, Math.abs(value)) }
    let instRms = Math.sqrt(sum / samples.length)
    rmsEnv += (instRms - rmsEnv) * (instRms > rmsEnv ? attack : release)
    peakEnv += (peak - peakEnv) * (peak > peakEnv ? 1 : release * 0.4)
    return `RMS ${dbfs(rmsEnv).toFixed(1)} dBFS, peak ${dbfs(peakEnv).toFixed(1)} dBFS`
  }
}

function createLatencyTracker(context, click, intervalSeconds) {
  let history = [], pending = null, lastScheduled = -Infinity, threshold = 0.06
  let schedule = () => {
    let when = context.currentTime + 0.05
    click(when)
    pending = { when, deadline: when + 0.8 }
    lastScheduled = when
  }
  return samples => {
    let now = context.currentTime
    if (pending) {
      for (let i = 0; i < samples.length; i++) {
        if (Math.abs(samples[i]) <= threshold) continue
        let sampleTime = now - (samples.length - i) / context.sampleRate
        if (sampleTime <= pending.when + 0.003) continue
        history.push((sampleTime - pending.when) * 1000)
        if (history.length > 7) history.shift()
        pending = null
        break
      }
      if (pending && now > pending.deadline) pending = null // honest miss: try again next interval
    } else if (now > lastScheduled + intervalSeconds) schedule()
    if (!history.length) return pending ? 'Listening for the click…' : 'No click detected yet — raise the volume or mic gain'
    let sorted = [...history].sort((a, b) => a - b)
    let median = sorted[Math.floor(sorted.length / 2)]
    return `${median.toFixed(0)} ms round trip (median of ${history.length})`
  }
}

// The highlighter files every member access under one category; a member that is called is a method
function splitMethods() {
  let properties = CSS.highlights?.get('property')
  if (!properties) return
  let methods = new Highlight()
  for (let range of [...properties]) {
    let node = range.endContainer
    if (node.nodeType === Node.TEXT_NODE && node.data[range.endOffset] === '(') { properties.delete(range); methods.add(range) }
  }
  CSS.highlights.set('method', methods)
}
export const highlight = root => highlightSyntax(root).then(splitMethods).catch(() => {})

async function loadCode(example, root, isCurrent) {
  let code = root.querySelector('#example-code'), source
  if (!code) return
  try {
    let response = await fetch(new URL(`./graphs/${example.id}.js`, import.meta.url))
    if (!response.ok) throw new Error(`Graph source returned ${response.status}`)
    source = await response.text()
  } catch {
    source = `// Source could not be loaded.\n// Open examples/graphs/${example.id}.js in the repository.`
  }
  if (!isCurrent()) return
  code.textContent = source
  // numbered like the hero's code
  let pane = code.closest('.code-output')
  if (pane) {
    let gutter = pane.querySelector('.lines') || pane.insertBefore(document.createElement('span'), code)
    gutter.className = 'lines'
    gutter.setAttribute('aria-hidden', 'true')
    gutter.textContent = Array.from({ length: code.textContent.split('\n').length }, (_, i) => String(i + 1).padStart(2, '0')).join('\n')
  }
  highlight(code.closest('.code-stage'))
}

// The graph tab: run the example's graph module against an offline context with its default
// options, record what it connects, and draw it at its own size, zoomable with a pinch (or ctrl and the wheel)
function zoomGraph(pane, factor) {
  pane.dataset.zoom = Math.min(3, Math.max(0.5, Number(pane.dataset.zoom || 1) * factor))
  let graph = pane.querySelector('.graph')
  if (graph) graph.style.width = `${graph.getAttribute('width') * pane.dataset.zoom}px`
}

async function showGraph(id, pane, isCurrent) {
  if (!pane.dataset.zoom) {
    pane.dataset.zoom = '1'
    pane.addEventListener('wheel', event => {
      if (!event.ctrlKey) return
      event.preventDefault()
      zoomGraph(pane, event.deltaY < 0 ? 1.1 : 0.9)
    }, { passive: false })
  }
  pane.innerHTML = '<p class="graph-note">Recording the graph…</p>'
  try {
    let { init } = await import(`./graphs/${id}.js`)
    if (!isCurrent()) return
    let options = Object.fromEntries(controlsFor(id).map(control => [control.key, control.value]))
    // an offline context schedules the whole run upfront, and the shape of a ten-minute session
    // is the shape of its first seconds, so the recording is capped at three
    options.duration = Math.min(3, Number(options.duration) || 3)
    let context = new OfflineAudioContext(2, 128, 44100)
    let edges = await recordConnections(AudioNode.prototype, () => init(context, { ...options, AudioWorkletNodeClass: globalThis.AudioWorkletNode }))
    if (!isCurrent()) return
    let resolved = resolveGraph(edges)
    if (!resolved.nodes.length) { pane.innerHTML = '<p class="graph-note">This example connects nothing until it runs.</p>'; return }
    let { nodes, edges: merged, counts } = collapseGraph(resolved.nodes, resolved.edges)
    pane.innerHTML = graphSVG(nodes, merged, `The graph ${id} connects`, counts)
    zoomGraph(pane, 1)
  } catch (error) {
    if (!isCurrent()) return
    let missing = /AudioWorkletNode|is not a constructor|undefined/i.test(error.message) && !globalThis.AudioWorkletNode
    pane.innerHTML = missing
      ? '<p class="graph-note">This graph is built from an AudioWorklet, which this browser does not expose here.</p>'
      : `<p class="graph-note">This graph needs a live input, so it cannot be recorded here. ${error.message}</p>`
  }
}

export function mountExample(root, id) {
  let example = byId.get(id)
  if (!example) throw new Error(`Unknown example: ${id}`)
  let find = selector => root.querySelector(selector)
  let form = find('#demo-form')
  let controls = find('#demo-controls')
  let fields = find('#demo-fields')
  let actions = find('#demo-actions')
  let run = find('#demo-run')
  let status = find('#demo-status')
  let canvas = find('#demo-canvas')
  let spectrogram = find('#demo-spectrogram')
  let frequencyScale = find('#demo-frequency-scale')
  remember(frequencyScale, 'demo-frequency-scale')
  let resultContainer = find('#demo-result')
  let meter = find('#demo-meter-fill')
  let meterValue = find('#demo-meter-value')
  run.removeAttribute('aria-busy')
  run.classList.toggle('is-iconic', example.mode !== 'node')
  if (example.mode !== 'node') run.setAttribute('aria-label', 'Run demo')
  fields.replaceChildren()
  clearAudioResult(resultContainer)
  actions.querySelector('.file-label')?.remove()
  createControls(id, fields)
  drawWave(canvas)
  resetSpectrogram(spectrogram)

  // CLI pane: command plus the full option schema, including CLI-only options
  let cliCommand = find('#cli-command')
  if (cliCommand) cliCommand.textContent = example.command
  let cliOptions = find('#cli-options')
  if (cliOptions) {
    cliOptions.replaceChildren(...optionsFor(id).map(option => {
      let item = document.createElement('div')
      let term = document.createElement('dt')
      let syntax = document.createElement('code')
      syntax.textContent = option.syntax
      term.append(syntax)
      let description = document.createElement('dd')
      description.textContent = option.description || ''
      item.append(term, description)
      return item
    }))
  }

  // The graph opens first, recorded on the spot; the code loads lazily
  let codeLoaded = false, disposed = false, runVersion = 0
  const isCurrent = () => !disposed
  let panes = { cli: find('#cli-pane'), code: find('#code-pane'), graph: find('#graph-pane') }
  let tabs = [...root.querySelectorAll('.code-tab')]
  let activatePane = name => {
    for (let tab of tabs) tab.setAttribute('aria-pressed', String(tab.dataset.pane === name))
    for (let key of Object.keys(panes)) if (panes[key]) panes[key].hidden = key !== name
    if (name === 'code' && !codeLoaded) {
      codeLoaded = true
      loadCode(example, root, isCurrent)
    }
    if (name === 'graph' && panes.graph) showGraph(id, panes.graph, isCurrent)
  }
  for (let tab of tabs) tab.onclick = () => activatePane(tab.dataset.pane)
  activatePane('graph')

  let volume = find('#demo-volume')
  remember(volume, 'demo-volume')
  if (volume) volume.hidden = !['audio', 'worklet'].includes(example.mode)
  let context = null, demo = null, analyser = null, stream = null, frame = 0, timer = 0, reloadTimer = 0
  let outputGain = null
  let volumeGain = () => Number(volume?.value ?? 25) / 100
  let capture = null, lastHistory = null, lastPaint = -1, paintScale = '', paintSize = ''
  let captureSignal = async () => {
    const observed = await observeSignal(context, analyser)
    if (disposed) observed?.dispose()
    else capture = observed
  }
  let connectOutput = async () => {
    outputGain = context.createGain()
    outputGain.gain.value = volumeGain()
    analyser.connect(outputGain).connect(context.destination)
    await captureSignal()
  }
  let paintVolume = () => volume?.style.setProperty('--fill', `${volume.value}%`)
  let onVolume = () => {
    paintVolume()
    outputGain?.gain.setTargetAtTime(volumeGain(), context?.currentTime || 0, 0.03)
  }
  paintVolume()
  volume?.addEventListener('input', onVolume)
  let samples = new Float32Array(2048), recorder = null
  let lastBuffer = null, live = false, busy = false, rendering = null
  let levelMeter = null, latencyTracker = null
  let observer = new ResizeObserver(() => {
    if (capture || lastHistory) {
      drawLiveSignal(canvas, spectrogram, capture?.history || lastHistory, frequencyScale.value)
      return
    }
    drawWave(canvas, lastBuffer?.getChannelData(0))
    if (lastBuffer) drawBufferSpectrogram(spectrogram, lastBuffer.getChannelData(0), lastBuffer.sampleRate, frequencyScale.value)
    else resetSpectrogram(spectrogram)
  })
  observer.observe(canvas)
  observer.observe(spectrogram)

  function setStatus(message, state = 'default') {
    status.textContent = message
    run.dataset.state = state
    run.setAttribute('aria-pressed', String(state === 'running'))
    if (state === 'error') run.classList.add('is-error')
    else run.classList.remove('is-error')
  }

  function animate() {
    if (!analyser) return
    if (samples.length !== analyser.fftSize) samples = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(samples)
    if (capture) {
      const history = capture.history, scale = frequencyScale.value
      const size = `${canvas.clientWidth}/${canvas.clientHeight}/${spectrogram.clientHeight}`
      if (lastPaint !== history.version || paintScale !== scale || paintSize !== size) {
        drawLiveSignal(canvas, spectrogram, history, scale)
        lastPaint = history.version; paintScale = scale; paintSize = size
      }
    }
    let level = rms(samples)
    meter.style.transform = `scaleX(${Math.min(1, level * 5)})`
    meterValue.textContent = dbLabel(level)
    // what this example measures, in its own words: pitch, ballistics, round trip, tempo
    let reading = id === 'tuner'
      ? pitchLabel(detectPitch(samples, context.sampleRate), Number(form.elements.a4?.value || 440))
      : id === 'level-meter' && levelMeter
      ? levelMeter(samples)
      : id === 'latency-tester' && latencyTracker
      ? latencyTracker(samples)
      : demo?.readout?.(context.currentTime) ?? ''
    if (!run.classList.contains('is-error')) {
      if (reading) status.textContent = reading
      else if (!capture && plotsVisible()) status.textContent = 'Live visualization unavailable in this browser.'
    }
    frame = setTimeout(animate, reducedMotion.matches ? 160 : 1000 / 30)
  }

  function cancelVisual() {
    clearTimeout(frame)
    frame = 0
  }

  async function stop(message = '') {
    // Only the latest start/stop may update controls or continue a parameter reload.
    const version = ++runVersion
    rendering?.abort()
    rendering = null
    clearTimeout(timer)
    cancelVisual()
    lastHistory = capture?.history || lastHistory
    capture?.dispose()
    capture = null
    lastPaint = -1
    // Retain the latest recorder's identity after stop: onstop may arrive after
    // both this recording and its replacement have closed their audio contexts.
    if (recorder?.state === 'recording') recorder.stop()
    if (disposed) recorder = null
    if (context) stopGraph(demo, context.currentTime)
    for (let track of stream?.getTracks?.() || []) track.stop()
    let closing = context
    context = null; demo = null; analyser = null; stream = null; outputGain = null
    levelMeter = null; latencyTracker = null
    if (closing && closing.state !== 'closed') await closing.close().catch(() => {})
    if (disposed || version !== runVersion) return false
    setButtonLabel(run, example.mode === 'node' ? 'Copy command' : 'Run demo')
    setStatus(message)
    meter.style.transform = 'scaleX(0)'
    return true
  }

  async function runPortable() {
    lastBuffer = null
    drawWave(canvas)
    resetSpectrogram(spectrogram)
    context = new AudioContext()
    await context.resume()
    if (disposed) return
    analyser = context.createAnalyser(); analyser.fftSize = 2048; analyser.minDecibels = -100; analyser.maxDecibels = -20
    await connectOutput()
    if (disposed) return
    let options = readOptions(id, form)
    options.destination = analyser
    // Duration is a browser control only where it shapes the music (a tempo ramp, a performance
    // arc, a loop count); elsewhere the demo runs long and relies on the play/stop button, same
    // as any other realtime instrument. Graphs that schedule a node (or worklet-driven event) per
    // beat upfront still need a bounded default, or a 600s run would build thousands of nodes.
    let scaledDurationDefaults = {
      continuity: 15, 'octave-illusion': 12, 'scale-illusion': 8, streaming: 15, 'zwicker-tone': 20,
    }
    if (!('duration' in options)) options.duration = scaledDurationDefaults[id] ?? 600
    if (['shepard', 'karplus-strong'].includes(id)) options.AudioWorkletNodeClass = globalThis.AudioWorkletNode
    // The metronome's instrument collection plays the beats of other rhythm graphs on request;
    // building it here keeps every graph module atomic
    if (id === 'risset-rhythm' && options.sound !== 'click') {
      let { createInstrument } = await import('./graphs/metronome.js')
      if (disposed) return
      options.hit = createInstrument(context, { sound: options.sound, destination: analyser }).hit
    }
    let { init } = await import(`./graphs/${id}.js`)
    if (disposed) return
    demo = await init(context, options)
    if (disposed) return
    setButtonLabel(run, 'Stop demo')
    setStatus(!capture && plotsVisible() ? 'Live visualization unavailable in this browser.' : '', 'running')
    animate()
    timer = setTimeout(() => stop('Finished.'), demo.duration * 1000 + 150)
  }

  async function runOffline() {
    let defaults = { 'linked-params': 2, fft: 1, 'render-to-buffer': 2 }
    let options = readOptions(id, form), duration = Number(options.duration || defaults[id] || 1)
    let rate = 44100
    setButtonLabel(run, 'Rendering')
    run.setAttribute('aria-busy', 'true')
    setStatus('Rendering with web-audio-api. No output device is open.', 'running')
    rendering = new AbortController()
    let { buffer } = await renderAudio(id, { duration, sampleRate: rate, options }, rendering.signal)
    rendering = null
    if (disposed) return
    let data = buffer.getChannelData(0)
    lastBuffer = buffer
    drawWave(canvas, data)
    drawBufferSpectrogram(spectrogram, data, buffer.sampleRate, frequencyScale.value)
    let peak = 0
    for (let value of data) peak = Math.max(peak, Math.abs(value))
    meter.style.transform = `scaleX(${Math.min(1, peak)})`
    meterValue.textContent = dbLabel(peak)
    setAudioResult(resultContainer, audioBufferToWav(buffer), `${example.id}.wav`, `Rendered ${example.id} audio`)
    setButtonLabel(run, 'Render again')
    run.removeAttribute('aria-busy')
    setStatus(`Rendered ${buffer.length.toLocaleString()} frames at ${buffer.sampleRate.toLocaleString()} Hz.`)
  }

  async function runFile(file) {
    if (!file) throw new Error('Choose an audio file before running the graph')
    let decode = new AudioContext()
    let source
    try { source = await decode.decodeAudioData(await file.arrayBuffer()) }
    finally { await decode.close() }
    if (disposed) return
    setButtonLabel(run, 'Processing')
    run.setAttribute('aria-busy', 'true')
    setStatus(`Processing ${file.name} in memory…`, 'running')
    rendering = new AbortController()
    let { buffer: output } = await renderAudio(id, {
      sampleRate: source.sampleRate,
      channels: Array.from({ length: source.numberOfChannels }, (_, ch) => source.getChannelData(ch)),
      options: readOptions(id, form),
    }, rendering.signal)
    rendering = null
    if (disposed) return
    lastBuffer = output
    drawWave(canvas, output.getChannelData(0))
    drawBufferSpectrogram(spectrogram, output.getChannelData(0), output.sampleRate, frequencyScale.value)
    setAudioResult(resultContainer, audioBufferToWav(output), `${file.name.replace(/\.[^.]+$/, '')}-processed.wav`, 'Processed audio')
    setButtonLabel(run, 'Process again')
    run.removeAttribute('aria-busy')
    setStatus(`Processed ${output.duration.toFixed(2)} s: high-shelf EQ → compressor → AudioBuffer`)
  }

  async function runWorklet() {
    lastBuffer = null
    resetSpectrogram(spectrogram)
    context = new AudioContext(); await context.resume()
    if (disposed) return
    analyser = context.createAnalyser(); analyser.fftSize = 2048; analyser.minDecibels = -100; analyser.maxDecibels = -20
    await connectOutput()
    if (disposed) return
    demo = await buildWorklet(context, { ...readOptions(id, form), destination: analyser, AudioWorkletNodeClass: globalThis.AudioWorkletNode })
    if (disposed) return
    setButtonLabel(run, 'Stop demo'); setStatus('', 'running')
    animate(); timer = setTimeout(() => stop('Finished.'), 1100)
  }

  async function runMic() {
    lastBuffer = null
    resetSpectrogram(spectrogram)
    let options = readOptions(id, form)
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    if (disposed) {
      for (const track of stream.getTracks()) track.stop()
      stream = null
      return
    }
    context = new AudioContext(); await context.resume()
    if (disposed) return
    let { init } = await import(`./graphs/${id}.js`)
    if (disposed) return
    demo = init(context, { stream, gain: Number(options.gain ?? 1), monitor: false })
    analyser = demo.nodes[2]; analyser.fftSize = 4096; analyser.minDecibels = -100; analyser.maxDecibels = -20
    await captureSignal()
    if (disposed) return
    levelMeter = id === 'level-meter' ? createLevelMeter(options.ballistics === 'fast') : null
    latencyTracker = id === 'latency-tester' ? createLatencyTracker(context, demo.data.click, Number(options.interval || 1.5)) : null
    if (id === 'recorder') {
      if (!window.MediaRecorder) throw new Error('MediaRecorder is not available in this browser')
      const chunks = []
      const recording = recorder = new MediaRecorder(stream)
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      let mimeType = recorder.mimeType || 'audio/webm'
      let filename = String(options.filename || 'recording').trim().replace(/[^a-z0-9._-]+/gi, '-') || 'recording'
      recorder.onstop = () => {
        if (disposed || recorder !== recording || !chunks.length) return
        let blob = new Blob(chunks, { type: mimeType })
        let extension = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'm4a' : 'webm'
        setAudioResult(resultContainer, blob, `${filename.replace(/\.[^.]+$/, '')}.${extension}`, 'Recorded microphone audio')
      }
      recorder.start()
    }
    setButtonLabel(run, id === 'recorder' ? 'Stop and save' : 'Stop microphone')
    setStatus(id === 'tuner' ? ''
      : id === 'recorder' ? 'Recording. Audio stays on this device until you download it.'
      : id === 'latency-tester' ? 'Clicking through the speakers and timing the return on the microphone.'
      : id === 'level-meter' ? 'Reading microphone level. Monitoring is muted to prevent feedback.'
      : 'Reading microphone RMS. Monitoring is muted to prevent feedback.', 'running')
    animate()
  }

  if (example.mode === 'file') {
    let label = document.createElement('label')
    label.className = 'file-label'; label.textContent = 'Choose audio file'
    let input = document.createElement('input'); input.type = 'file'; input.accept = 'audio/*'; input.id = 'audio-file'
    label.append(input); actions.prepend(label)
    input.addEventListener('change', () => { label.firstChild.textContent = input.files[0]?.name || 'Choose audio file' })
  }

  form.hidden = controls.hidden = fields.childElementCount === 0 && actions.childElementCount === 0

  if (example.mode === 'node') {
    setButtonLabel(run, 'Copy command')
    setStatus('Run this command in Node to stream PCM to another process.')
  } else {
    setStatus('')
  }

  let startDemo = async () => {
    if (busy || disposed) return
    runVersion++
    busy = true
    lastHistory = null
    run.setAttribute('aria-busy', 'true')
    setButtonLabel(run, 'Starting')
    try {
      if (example.mode === 'offline') await runOffline()
      else if (example.mode === 'file') await runFile(find('#audio-file')?.files?.[0])
      else if (example.mode === 'worklet') await runWorklet()
      else if (example.mode === 'mic') await runMic()
      else await runPortable()
      if (disposed) return
      live = true
    } catch (error) {
      if (disposed) return
      live = false
      let message = `${error.message}. Check permissions or input, then try again.`
      if (context) await stop(message)
      if (disposed) return
      setButtonLabel(run, 'Try again')
      setStatus(message, 'error')
    } finally {
      busy = false
      if (!disposed) run.removeAttribute('aria-busy')
    }
  }

  let onRun = async () => {
    if (busy) return
    if (context) {
      live = false
      return stop()
    }
    if (example.mode === 'node') return copyText(run, example.command)
    await startDemo()
  }

  let reloadDemo = async () => {
    if (!live || busy || disposed) return
    if (context && !(await stop('Applying updated controls.'))) return
    await startDemo()
  }

  let scheduleReload = event => {
    if (!live || event.target === volume) return
    clearTimeout(reloadTimer)
    reloadTimer = setTimeout(reloadDemo, 180)
  }

  let onControlInput = event => {
    if (event.target?.type === 'range') scheduleReload(event)
  }

  let onScaleChange = () => {
    if (capture || lastHistory) drawLiveSignal(canvas, spectrogram, capture?.history || lastHistory, frequencyScale.value)
    else if (lastBuffer) drawBufferSpectrogram(spectrogram, lastBuffer.getChannelData(0), lastBuffer.sampleRate, frequencyScale.value)
    else resetSpectrogram(spectrogram)
  }

  run.addEventListener('click', onRun)
  form.addEventListener('input', onControlInput)
  form.addEventListener('change', scheduleReload)
  frequencyScale.addEventListener('change', onScaleChange)

  return async () => {
    disposed = true
    live = false
    clearTimeout(reloadTimer)
    observer.disconnect()
    run.removeEventListener('click', onRun)
    volume?.removeEventListener('input', onVolume)
    form.removeEventListener('input', onControlInput)
    form.removeEventListener('change', scheduleReload)
    frequencyScale.removeEventListener('change', onScaleChange)
    clearAudioResult(resultContainer)
    await stop('')
  }
}

let detailPage = document.querySelector('[data-example]')
if (detailPage) {
  let cleanup = mountExample(document, detailPage.dataset.example)
  addEventListener('pagehide', cleanup)
}
highlight()

// The catalogue filters itself by job tag, on the homepage's featured row and on the catalogue page
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

// horizontal stripe band: equal cells whose bars grow linearly toward the solid edge;
// every band steps in the same half rem, whatever its own height
const stripStep = Math.max(2, parseFloat(getComputedStyle(document.documentElement).fontSize) / 2 || 8)
export function stripBand(canvas, solidTop, colorToken = '--color-ink', cellSize = stripStep) {
  let context = canvas.getContext('2d')
  let painted = ''
  let paint = () => {
    let ratio = Math.min(devicePixelRatio || 1, 2)
    let width = canvas.offsetWidth * ratio, height = canvas.offsetHeight * ratio
    if (height < 1) return
    // a scroll that slides a phone's address bar away fires resize without changing the band
    if (painted === `${width}x${height}`) return
    painted = `${width}x${height}`
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
    let cell = Math.max(2, Math.round(cellSize * ratio))
    let cells = Math.max(2, Math.ceil(height / cell))
    context.clearRect(0, 0, width, height)
    context.fillStyle = css(colorToken)
    for (let k = 0; k < cells; k++) {
      let t = k / (cells - 1)
      let bar = Math.round(cell * (solidTop ? 1 - t : t))
      if (!bar) continue
      // a solid-top band fades from its very first row: every cell keeps a hairline gap
      if (solidTop) bar = Math.min(bar, cell - 1)
      context.fillRect(0, solidTop ? k * cell : (k + 1) * cell - bar, width, bar)
    }
    // the solid end runs past the last cell: the bitmap's edge row is whole, whatever the rounding
    if (!solidTop) context.fillRect(0, cells * cell, width, height - cells * cell + cell)
  }
  paint()
  addEventListener('resize', paint)
}

for (let canvas of document.querySelectorAll('.header-strips')) stripBand(canvas, true, '--color-white')
for (let canvas of document.querySelectorAll('.footer-strips')) stripBand(canvas, false)

// the bands stand between the sections, dissolving the paper into the white field and back again
for (let canvas of document.querySelectorAll('.field-strips')) stripBand(canvas, canvas.classList.contains('faq-strips'), '--color-white')
