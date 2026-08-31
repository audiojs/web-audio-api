import { byId } from './catalog.js'
import { controlsFor } from './options.js'
import { highlightSyntax } from '../syntax.js'
import { build as buildProcessedBuffer } from './graphs/process-file.js'
import { build as buildWorklet } from './graphs/worklet.js'

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

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
    let initialValue = spec.browserValue ?? spec.value
    label.className = 'control-field'
    let heading = document.createElement('span')
    let name = document.createElement('span')
    name.textContent = spec.label
    heading.append(name)
    let output
    if (spec.type === 'range') {
      output = document.createElement('output')
      output.textContent = `${initialValue}${spec.unit ? ` ${spec.unit}` : ''}`
      heading.append(output)
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
    if (output) control.addEventListener('input', () => { output.textContent = `${control.value}${spec.unit ? ` ${spec.unit}` : ''}` })
    label.htmlFor = control.id
    label.append(control)
    container.append(label)
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

function sizeCanvas(canvas) {
  let rect = canvas.getBoundingClientRect(), ratio = Math.min(devicePixelRatio || 1, 2)
  let width = Math.max(1, Math.round(rect.width * ratio)), height = Math.max(1, Math.round(rect.height * ratio))
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
}

function drawWave(canvas, data = null) {
  sizeCanvas(canvas)
  let ctx = canvas.getContext('2d'), width = canvas.width, height = canvas.height
  ctx.clearRect(0, 0, width, height)
  ctx.strokeStyle = css('--color-rule-dark')
  ctx.lineWidth = Math.max(1, devicePixelRatio || 1)
  for (let row = 1; row < 4; row++) {
    let y = height * row / 4
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke()
  }
  ctx.strokeStyle = css('--color-accent')
  ctx.lineWidth = Math.max(2, (devicePixelRatio || 1) * 1.5)
  ctx.beginPath()
  let length = data?.length || 256
  let stride = Math.max(1, Math.floor(length / Math.max(256, width)))
  let points = Math.ceil(length / stride)
  for (let index = 0, point = 0; index < length; index += stride, point++) {
    let x = point / Math.max(1, points - 1) * width
    let value = data ? data[index] : Math.sin(point / points * Math.PI * 8) * 0.3
    let y = height * (0.5 - value * 0.42)
    if (point === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.stroke()
}

function drawSpectrum(canvas, data) {
  sizeCanvas(canvas)
  let ctx = canvas.getContext('2d'), width = canvas.width, height = canvas.height
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = css('--color-accent')
  let bins = 72, stride = Math.max(1, Math.floor(data.length / bins))
  for (let bin = 0; bin < bins; bin++) {
    let value = 0
    for (let i = 0; i < stride; i++) value = Math.max(value, Math.abs(data[bin * stride + i] || 0))
    let barHeight = Math.max(1, value * height * 2.5)
    let barWidth = width / bins
    ctx.fillRect(bin * barWidth, height - barHeight, Math.max(1, barWidth - 1), barHeight)
  }
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

function setRenderedAudio(container, buffer, name) {
  container.replaceChildren()
  let url = URL.createObjectURL(audioBufferToWav(buffer))
  let audio = document.createElement('audio')
  audio.controls = true
  audio.preload = 'metadata'
  audio.src = url
  audio.setAttribute('aria-label', `Rendered ${name} audio`)
  let download = document.createElement('a')
  download.className = 'demo-action'
  download.href = url
  download.download = `${name}.wav`
  download.textContent = 'Download WAV'
  container.append(audio, download)
}

function rms(data) {
  let sum = 0
  for (let value of data) sum += value * value
  return Math.sqrt(sum / data.length)
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
  return `${note} · ${frequency.toFixed(1)} Hz · ${cents >= 0 ? '+' : ''}${cents} cents`
}

async function loadCode(example, root = document) {
  let code = root.querySelector('#example-code')
  if (!code) return
  try {
    let response = await fetch(new URL(`./graphs/${example.id}.js`, import.meta.url))
    if (!response.ok) throw new Error(`Graph source returned ${response.status}`)
    code.textContent = await response.text()
  } catch {
    code.textContent = `// Source could not be loaded.\n// Open examples/graphs/${example.id}.js in the repository.`
  }
  highlightSyntax(code.closest('.code-stage')).catch(() => {})
}

export function mountExample(root, id) {
  let example = byId.get(id)
  if (!example) throw new Error(`Unknown example: ${id}`)
  let find = selector => root.querySelector(selector)
  let form = find('#demo-form')
  let fields = find('#demo-fields')
  let actions = find('#demo-actions')
  let run = find('#demo-run')
  let status = find('#demo-status')
  let canvas = find('#demo-canvas')
  let resultContainer = find('#demo-result')
  let meter = find('#demo-meter-fill')
  let meterValue = find('#demo-meter-value')
  let freshRun = run.cloneNode(true)
  run.replaceWith(freshRun)
  run = freshRun
  fields.replaceChildren()
  resultContainer.replaceChildren()
  actions.querySelector('.file-label')?.remove()
  createControls(id, fields)
  loadCode(example, root)
  drawWave(canvas)
  let observer = new ResizeObserver(() => drawWave(canvas))
  observer.observe(canvas)

  let context = null, demo = null, analyser = null, stream = null, frame = 0, timer = 0
  let samples = new Float32Array(2048), recorder = null, chunks = []

  function setStatus(message, state = 'default') {
    status.textContent = message
    run.dataset.state = state
    run.setAttribute('aria-pressed', String(state === 'running'))
    if (state === 'error') run.classList.add('is-error')
    else run.classList.remove('is-error')
  }

  function animate(kind = 'wave') {
    if (!analyser) return
    if (kind === 'spectrum') {
      let spectrum = new Float32Array(analyser.frequencyBinCount)
      analyser.getFloatFrequencyData(spectrum)
      let normalized = Float32Array.from(spectrum, value => Math.max(0, (value + 100) / 100))
      drawSpectrum(canvas, normalized)
    } else {
      analyser.getFloatTimeDomainData(samples)
      drawWave(canvas, samples)
    }
    let level = rms(samples)
    meter.style.transform = `scaleX(${Math.min(1, level * 5)})`
    meterValue.textContent = id === 'tuner'
      ? pitchLabel(detectPitch(samples, context.sampleRate), Number(form.elements.a4?.value || 440))
      : `${(20 * Math.log10(Math.max(level, 1e-6))).toFixed(1)} dBFS`
    if (reducedMotion.matches) frame = setTimeout(() => animate(kind), 160)
    else frame = requestAnimationFrame(() => animate(kind))
  }

  function cancelVisual() {
    if (reducedMotion.matches) clearTimeout(frame)
    else cancelAnimationFrame(frame)
    frame = 0
  }

  async function stop(message = 'Stopped. The context and any device stream are closed.') {
    clearTimeout(timer)
    cancelVisual()
    if (recorder?.state === 'recording') recorder.stop()
    recorder = null
    if (context) stopGraph(demo, context.currentTime)
    for (let track of stream?.getTracks?.() || []) track.stop()
    let closing = context
    context = null; demo = null; analyser = null; stream = null
    if (closing && closing.state !== 'closed') await closing.close().catch(() => {})
    setButtonLabel(run, example.mode === 'node' ? 'Copy command' : 'Run demo')
    setStatus(message)
    meter.style.transform = 'scaleX(0)'
  }

  async function runPortable() {
    context = new AudioContext()
    await context.resume()
    analyser = context.createAnalyser(); analyser.fftSize = 2048; analyser.connect(context.destination)
    let options = readOptions(id, form)
    options.destination = analyser
    if (!('duration' in options)) options.duration = ['jazz'].includes(id) ? 7 : ['risset-rhythm', 'serial', 'gamelan', 'drone'].includes(id) ? 5 : 3
    if (['shepard', 'karplus-strong', 'jazz'].includes(id)) options.AudioWorkletNodeClass = AudioWorkletNode
    let { build } = await import(`./graphs/${id}.js`)
    demo = await build(context, options)
    setButtonLabel(run, 'Stop demo')
    setStatus(`Running with the browser’s native AudioContext · ${demo.graph}`, 'running')
    animate(id === 'fft' ? 'spectrum' : 'wave')
    timer = setTimeout(() => stop('Complete. The graph stopped and the AudioContext closed.'), demo.duration * 1000 + 150)
  }

  async function runOffline() {
    let defaults = { 'linked-params': 2, fft: 1, 'render-to-buffer': 2 }
    let options = readOptions(id, form), duration = Number(options.duration || defaults[id] || 1)
    let rate = 44100
    let offline = new OfflineAudioContext(2, Math.ceil(rate * duration), rate)
    options.when = 0; options.duration = duration
    let { build } = await import(`./graphs/${id}.js`)
    let offlineDemo = await build(offline, options)
    setButtonLabel(run, 'Rendering')
    run.setAttribute('aria-busy', 'true')
    setStatus('Rendering the graph in memory. No output device is open.', 'running')
    let buffer = await offline.startRendering()
    let data = buffer.getChannelData(0)
    drawWave(canvas, data)
    let peak = 0
    for (let value of data) peak = Math.max(peak, Math.abs(value))
    meter.style.transform = `scaleX(${Math.min(1, peak)})`
    meterValue.textContent = `peak ${(20 * Math.log10(Math.max(peak, 1e-6))).toFixed(1)} dBFS`
    setRenderedAudio(resultContainer, buffer, example.id)
    setButtonLabel(run, 'Render again')
    run.removeAttribute('aria-busy')
    setStatus(`Rendered ${buffer.length.toLocaleString()} frames at ${buffer.sampleRate.toLocaleString()} Hz · ${offlineDemo.graph}`)
  }

  async function runFile(file) {
    if (!file) throw new Error('Choose an audio file before running the graph')
    let decode = new AudioContext()
    let source = await decode.decodeAudioData(await file.arrayBuffer())
    await decode.close()
    let offline = new OfflineAudioContext(source.numberOfChannels, source.length, source.sampleRate)
    buildProcessedBuffer(offline, source, { when: 0 })
    setButtonLabel(run, 'Processing')
    run.setAttribute('aria-busy', 'true')
    setStatus(`Processing ${file.name} in memory…`, 'running')
    let output = await offline.startRendering()
    drawWave(canvas, output.getChannelData(0))
    setRenderedAudio(resultContainer, output, `${file.name.replace(/\.[^.]+$/, '')}-processed`)
    setButtonLabel(run, 'Process again')
    run.removeAttribute('aria-busy')
    setStatus(`Processed ${output.duration.toFixed(2)} s · high-shelf EQ → compressor → AudioBuffer`)
  }

  async function runWorklet() {
    context = new AudioContext(); await context.resume()
    analyser = context.createAnalyser(); analyser.fftSize = 2048; analyser.connect(context.destination)
    demo = await buildWorklet(context, { destination: analyser, AudioWorkletNodeClass: AudioWorkletNode })
    setButtonLabel(run, 'Stop demo'); setStatus('Custom AudioWorkletProcessor is running in the browser worklet thread.', 'running')
    animate(); timer = setTimeout(() => stop('Complete. The worklet node and context are closed.'), 1100)
  }

  async function runMic() {
    let options = readOptions(id, form)
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    context = new AudioContext(); await context.resume()
    let { build } = await import(`./graphs/${id}.js`)
    demo = build(context, { stream, gain: Number(options.gain ?? 1), monitor: false })
    analyser = demo.nodes[2]; analyser.fftSize = 4096
    if (id === 'recorder') {
      if (!window.MediaRecorder) throw new Error('MediaRecorder is not available in this browser')
      chunks = []; recorder = new MediaRecorder(stream)
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      let mimeType = recorder.mimeType || 'audio/webm'
      let filename = String(options.filename || 'recording').trim().replace(/[^a-z0-9._-]+/gi, '-') || 'recording'
      recorder.onstop = () => {
        let blob = new Blob(chunks, { type: mimeType })
        let url = URL.createObjectURL(blob)
        resultContainer.replaceChildren()
        let audio = document.createElement('audio'); audio.controls = true; audio.src = url; audio.setAttribute('aria-label', 'Recorded microphone audio')
        let extension = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'm4a' : 'webm'
        let download = document.createElement('a'); download.className = 'demo-action'; download.href = url; download.download = `${filename.replace(/\.[^.]+$/, '')}.${extension}`; download.textContent = 'Download recording'
        resultContainer.append(audio, download)
      }
      recorder.start()
    }
    setButtonLabel(run, id === 'recorder' ? 'Stop and save' : 'Stop microphone')
    setStatus(id === 'tuner' ? 'Listening for a stable pitch. Audio stays on this device.' : id === 'recorder' ? 'Recording. Audio stays on this device until you download it.' : 'Reading microphone RMS. Monitoring is muted to prevent feedback.', 'running')
    animate()
  }

  if (example.mode === 'file') {
    let label = document.createElement('label')
    label.className = 'file-label'; label.textContent = 'Choose audio file'
    let input = document.createElement('input'); input.type = 'file'; input.accept = 'audio/*'; input.id = 'audio-file'
    label.append(input); actions.prepend(label)
    input.addEventListener('change', () => { label.firstChild.textContent = input.files[0]?.name || 'Choose audio file' })
  }

  if (example.mode === 'node') {
    setButtonLabel(run, 'Copy command')
    setStatus('This adapter is intentionally Node-only: a browser has no process.stdout Writable.')
  }

  run.addEventListener('click', async () => {
    if (context) return stop()
    if (example.mode === 'node') return copyText(run, example.command)
    run.setAttribute('aria-busy', 'true')
    setButtonLabel(run, 'Starting')
    try {
      if (example.mode === 'offline') await runOffline()
      else if (example.mode === 'file') await runFile(find('#audio-file')?.files?.[0])
      else if (example.mode === 'worklet') await runWorklet()
      else if (example.mode === 'mic') await runMic()
      else await runPortable()
    } catch (error) {
      setButtonLabel(run, 'Try again')
      setStatus(`${error.message}. Check permissions or input, then try again.`, 'error')
      if (context) await stop(status.textContent)
      run.classList.add('is-error')
    } finally {
      run.removeAttribute('aria-busy')
    }
  })

  return async () => {
    observer.disconnect()
    await stop('Closed.')
  }
}

let detailPage = document.querySelector('[data-example]')
if (detailPage) {
  let cleanup = mountExample(document, detailPage.dataset.example)
  addEventListener('pagehide', cleanup)
}
highlightSyntax().catch(() => {})
