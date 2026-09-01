import { byId } from './catalog.js'
import { controlsFor, optionsFor } from './options.js'
import { highlightSyntax } from '../syntax.js'
import { init as buildProcessedBuffer } from './graphs/process-file.js'
import { init as buildWorklet } from './graphs/worklet.js'

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
  // Iconic buttons hide the span visually; the label still names the control
  if (button?.classList?.contains('is-iconic')) button.setAttribute('aria-label', label)
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
    if (output) control.addEventListener('input', () => { output.textContent = format(control.value) })
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
  let changed = canvas.width !== width || canvas.height !== height
  if (changed) { canvas.width = width; canvas.height = height }
  return changed
}

function drawWave(canvas, data = null) {
  sizeCanvas(canvas)
  let ctx = canvas.getContext('2d'), width = canvas.width, height = canvas.height
  ctx.clearRect(0, 0, width, height)
  ctx.strokeStyle = css('--color-rule-dark')
  ctx.lineWidth = Math.max(1, devicePixelRatio || 1)
  ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke()
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
  sizeCanvas(canvas)
  let ctx = canvas.getContext('2d')
  ctx.globalAlpha = 1
  ctx.clearRect(0, 0, canvas.width, canvas.height)
}

function drawSpectrogramColumn(canvas, data, sampleRate, scale) {
  if (sizeCanvas(canvas)) resetSpectrogram(canvas)
  let ctx = canvas.getContext('2d'), width = canvas.width, height = canvas.height
  let step = Math.max(2, Math.round(Math.min(devicePixelRatio || 1, 2) * 1.5))
  if (width <= step) { resetSpectrogram(canvas); return }
  ctx.globalAlpha = 1
  // 'copy' scrolls the transparent history left without alpha accumulation
  ctx.globalCompositeOperation = 'copy'
  ctx.drawImage(canvas, step, 0, width - step, height, 0, 0, width - step, height)
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = css('--color-accent')
  for (let y = 0; y < height; y++) {
    let frequency = frequencyAt(y, height, sampleRate, scale)
    let bin = Math.min(data.length - 1, Math.max(0, Math.round(frequency / (sampleRate / 2) * (data.length - 1))))
    let amount = Math.max(0, Math.min(1, (data[bin] + 100) / 75))
    ctx.globalAlpha = amount * amount
    ctx.fillRect(width - step, y, step, 1)
  }
  ctx.globalAlpha = 1
}

function drawBufferSpectrogram(canvas, data, sampleRate, scale) {
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
  let controls = find('#demo-controls')
  let fields = find('#demo-fields')
  let actions = find('#demo-actions')
  let run = find('#demo-run')
  let status = find('#demo-status')
  let canvas = find('#demo-canvas')
  let spectrogram = find('#demo-spectrogram')
  let frequencyScale = find('#demo-frequency-scale')
  let resultContainer = find('#demo-result')
  let meter = find('#demo-meter-fill')
  let meterValue = find('#demo-meter-value')
  let freshRun = run.cloneNode(true)
  run.replaceWith(freshRun)
  run = freshRun
  run.classList.toggle('is-iconic', example.mode !== 'node')
  if (example.mode !== 'node') run.setAttribute('aria-label', 'Run demo')
  fields.replaceChildren()
  resultContainer.replaceChildren()
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

  // Code loads lazily: the CLI tab is the default view
  let codeLoaded = false
  let panes = { cli: find('#cli-pane'), code: find('#code-pane') }
  let tabs = [...root.querySelectorAll('.code-tab')]
  let activatePane = name => {
    for (let tab of tabs) tab.setAttribute('aria-pressed', String(tab.dataset.pane === name))
    for (let key of Object.keys(panes)) if (panes[key]) panes[key].hidden = key !== name
    if (name === 'code' && !codeLoaded) {
      codeLoaded = true
      loadCode(example, root)
    }
  }
  for (let tab of tabs) tab.onclick = () => activatePane(tab.dataset.pane)
  activatePane('cli')

  let volume = find('#demo-volume')
  if (volume) volume.hidden = !['audio', 'worklet'].includes(example.mode)
  let context = null, demo = null, analyser = null, stream = null, frame = 0, timer = 0, reloadTimer = 0
  let outputGain = null
  let volumeGain = () => Number(volume?.value ?? 25) / 100
  let connectOutput = () => {
    outputGain = context.createGain()
    outputGain.gain.value = volumeGain()
    analyser.connect(outputGain).connect(context.destination)
  }
  let paintVolume = () => volume?.style.setProperty('--fill', `${volume.value}%`)
  let onVolume = () => {
    paintVolume()
    outputGain?.gain.setTargetAtTime(volumeGain(), context?.currentTime || 0, 0.03)
  }
  paintVolume()
  volume?.addEventListener('input', onVolume)
  let samples = new Float32Array(2048), spectrum = new Float32Array(1024), recorder = null, chunks = []
  let lastBuffer = null, live = false, busy = false, disposed = false
  let levelMeter = null, latencyTracker = null
  let observer = new ResizeObserver(() => {
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
    if (spectrum.length !== analyser.frequencyBinCount) spectrum = new Float32Array(analyser.frequencyBinCount)
    analyser.getFloatTimeDomainData(samples)
    analyser.getFloatFrequencyData(spectrum)
    drawWave(canvas, samples)
    drawSpectrogramColumn(spectrogram, spectrum, context.sampleRate, frequencyScale.value)
    let level = rms(samples)
    meter.style.transform = `scaleX(${Math.min(1, level * 5)})`
    meterValue.textContent = id === 'tuner'
      ? pitchLabel(detectPitch(samples, context.sampleRate), Number(form.elements.a4?.value || 440))
      : id === 'level-meter' && levelMeter
      ? levelMeter(samples)
      : id === 'latency-tester' && latencyTracker
      ? latencyTracker(samples)
      : `${(20 * Math.log10(Math.max(level, 1e-6))).toFixed(1)} dBFS`
    if (reducedMotion.matches) frame = setTimeout(animate, 160)
    else frame = requestAnimationFrame(animate)
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
    context = null; demo = null; analyser = null; stream = null; outputGain = null
    levelMeter = null; latencyTracker = null
    if (closing && closing.state !== 'closed') await closing.close().catch(() => {})
    setButtonLabel(run, example.mode === 'node' ? 'Copy command' : 'Run demo')
    setStatus(message)
    meter.style.transform = 'scaleX(0)'
  }

  async function runPortable() {
    lastBuffer = null
    resetSpectrogram(spectrogram)
    context = new AudioContext()
    await context.resume()
    analyser = context.createAnalyser(); analyser.fftSize = 2048; analyser.minDecibels = -100; analyser.maxDecibels = -20
    connectOutput()
    let options = readOptions(id, form)
    options.destination = analyser
    // The duration control lives in the CLI only now; the browser demo runs long and relies on
    // the play/stop button, same as any other realtime instrument. Graphs that schedule a node
    // (or worklet-driven event) per beat rather than looping a fixed voice bank still need a
    // bounded default, or a 600s run would build thousands of nodes upfront in a live context.
    let scaledDurationDefaults = {
      jazz: 7, sequencer: 1.75, gamelan: 20, serial: 30, 'risset-rhythm': 20,
      continuity: 15, 'octave-illusion': 12, 'scale-illusion': 8, streaming: 15, 'zwicker-tone': 20,
    }
    if (!('duration' in options)) options.duration = scaledDurationDefaults[id] ?? 600
    if (['shepard', 'karplus-strong', 'jazz'].includes(id)) options.AudioWorkletNodeClass = AudioWorkletNode
    let { init } = await import(`./graphs/${id}.js`)
    demo = await init(context, options)
    setButtonLabel(run, 'Stop demo')
    setStatus(`Running with the browser’s native AudioContext: ${demo.graph}`, 'running')
    animate()
    timer = setTimeout(() => stop('Complete. The graph stopped and the AudioContext closed.'), demo.duration * 1000 + 150)
  }

  async function runOffline() {
    let defaults = { 'linked-params': 2, fft: 1, 'render-to-buffer': 2 }
    let options = readOptions(id, form), duration = Number(options.duration || defaults[id] || 1)
    let rate = 44100
    let offline = new OfflineAudioContext(2, Math.ceil(rate * duration), rate)
    options.when = 0; options.duration = duration
    let { init } = await import(`./graphs/${id}.js`)
    let offlineDemo = await init(offline, options)
    setButtonLabel(run, 'Rendering')
    run.setAttribute('aria-busy', 'true')
    setStatus('Rendering the graph in memory. No output device is open.', 'running')
    let buffer = await offline.startRendering()
    let data = buffer.getChannelData(0)
    lastBuffer = buffer
    drawWave(canvas, data)
    drawBufferSpectrogram(spectrogram, data, buffer.sampleRate, frequencyScale.value)
    let peak = 0
    for (let value of data) peak = Math.max(peak, Math.abs(value))
    meter.style.transform = `scaleX(${Math.min(1, peak)})`
    meterValue.textContent = `peak ${(20 * Math.log10(Math.max(peak, 1e-6))).toFixed(1)} dBFS`
    setRenderedAudio(resultContainer, buffer, example.id)
    setButtonLabel(run, 'Render again')
    run.removeAttribute('aria-busy')
    setStatus(`Rendered ${buffer.length.toLocaleString()} frames at ${buffer.sampleRate.toLocaleString()} Hz: ${offlineDemo.graph}`)
  }

  async function runFile(file) {
    if (!file) throw new Error('Choose an audio file before running the graph')
    let decode = new AudioContext()
    let source = await decode.decodeAudioData(await file.arrayBuffer())
    await decode.close()
    let offline = new OfflineAudioContext(source.numberOfChannels, source.length, source.sampleRate)
    buildProcessedBuffer(offline, source, { when: 0, ...readOptions(id, form) })
    setButtonLabel(run, 'Processing')
    run.setAttribute('aria-busy', 'true')
    setStatus(`Processing ${file.name} in memory…`, 'running')
    let output = await offline.startRendering()
    lastBuffer = output
    drawWave(canvas, output.getChannelData(0))
    drawBufferSpectrogram(spectrogram, output.getChannelData(0), output.sampleRate, frequencyScale.value)
    setRenderedAudio(resultContainer, output, `${file.name.replace(/\.[^.]+$/, '')}-processed`)
    setButtonLabel(run, 'Process again')
    run.removeAttribute('aria-busy')
    setStatus(`Processed ${output.duration.toFixed(2)} s: high-shelf EQ → compressor → AudioBuffer`)
  }

  async function runWorklet() {
    lastBuffer = null
    resetSpectrogram(spectrogram)
    context = new AudioContext(); await context.resume()
    analyser = context.createAnalyser(); analyser.fftSize = 2048; analyser.minDecibels = -100; analyser.maxDecibels = -20
    connectOutput()
    demo = await buildWorklet(context, { ...readOptions(id, form), destination: analyser, AudioWorkletNodeClass: AudioWorkletNode })
    setButtonLabel(run, 'Stop demo'); setStatus('Custom AudioWorkletProcessor is running in the browser worklet thread.', 'running')
    animate(); timer = setTimeout(() => stop('Complete. The worklet node and context are closed.'), 1100)
  }

  async function runMic() {
    lastBuffer = null
    resetSpectrogram(spectrogram)
    let options = readOptions(id, form)
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    context = new AudioContext(); await context.resume()
    let { init } = await import(`./graphs/${id}.js`)
    demo = init(context, { stream, gain: Number(options.gain ?? 1), monitor: false })
    analyser = demo.nodes[2]; analyser.fftSize = 4096; analyser.minDecibels = -100; analyser.maxDecibels = -20
    levelMeter = id === 'level-meter' ? createLevelMeter(options.ballistics === 'fast') : null
    latencyTracker = id === 'latency-tester' ? createLatencyTracker(context, demo.data.click, Number(options.interval || 1.5)) : null
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
    setStatus(id === 'tuner' ? 'Listening for a stable pitch. Audio stays on this device.'
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

  controls.hidden = fields.childElementCount === 0 && actions.childElementCount === 0

  if (example.mode === 'node') {
    setButtonLabel(run, 'Copy command')
    setStatus('This adapter is intentionally Node-only: a browser has no process.stdout Writable.')
  } else {
    setStatus('')
  }

  let startDemo = async () => {
    if (busy || disposed) return
    busy = true
    run.setAttribute('aria-busy', 'true')
    setButtonLabel(run, 'Starting')
    try {
      if (example.mode === 'offline') await runOffline()
      else if (example.mode === 'file') await runFile(find('#audio-file')?.files?.[0])
      else if (example.mode === 'worklet') await runWorklet()
      else if (example.mode === 'mic') await runMic()
      else await runPortable()
      live = true
    } catch (error) {
      live = false
      let message = `${error.message}. Check permissions or input, then try again.`
      if (context) await stop(message)
      setButtonLabel(run, 'Try again')
      setStatus(message, 'error')
    } finally {
      busy = false
      run.removeAttribute('aria-busy')
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
    if (context) await stop('Applying updated controls.')
    await startDemo()
  }

  let scheduleReload = event => {
    if (!live || event.target?.type === 'file' || event.target === volume) return
    clearTimeout(reloadTimer)
    reloadTimer = setTimeout(reloadDemo, 180)
  }

  let onControlInput = event => {
    if (event.target?.type === 'range') scheduleReload(event)
  }

  let onScaleChange = () => {
    if (lastBuffer) drawBufferSpectrogram(spectrogram, lastBuffer.getChannelData(0), lastBuffer.sampleRate, frequencyScale.value)
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
    volume?.removeEventListener('input', onVolume)
    form.removeEventListener('input', onControlInput)
    form.removeEventListener('change', scheduleReload)
    frequencyScale.removeEventListener('change', onScaleChange)
    await stop('')
  }
}

let detailPage = document.querySelector('[data-example]')
if (detailPage) {
  let cleanup = mountExample(document, detailPage.dataset.example)
  addEventListener('pagehide', cleanup)
}
highlightSyntax().catch(() => {})

// horizontal stripe band: equal integer cells whose bars grow linearly toward the solid edge
export function stripBand(canvas, solidTop, colorToken = '--color-ink', cellSize = 8) {
  let context = canvas.getContext('2d')
  let paint = () => {
    let ratio = Math.min(devicePixelRatio || 1, 2)
    let width = canvas.offsetWidth * ratio, height = canvas.offsetHeight * ratio
    if (height < 1) return
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
    let cells = Math.max(2, Math.round(canvas.offsetHeight / cellSize))
    let cell = Math.max(2, Math.round(height / cells))
    context.clearRect(0, 0, width, height)
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(colorToken).trim()
    for (let k = 0; k < cells; k++) {
      let t = k / (cells - 1)
      let bar = Math.round(cell * (solidTop ? 1 - t : t))
      if (!bar) continue
      // a solid-top band fades from its very first row: every cell keeps a hairline gap
      if (solidTop) bar = Math.min(bar, cell - 1)
      context.fillRect(0, solidTop ? k * cell : (k + 1) * cell - bar, width, bar)
    }
    if (!solidTop) context.fillRect(0, cells * cell, width, height - cells * cell)
  }
  paint()
  addEventListener('resize', paint)
}

let footerStrips = document.querySelector('.footer-strips')
if (footerStrips) stripBand(footerStrips, false)
