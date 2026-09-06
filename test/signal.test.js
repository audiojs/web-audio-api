import test, { is, ok } from 'tst'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { SignalHistory, observeSignal } from '../assets/signal.js'
import assert from 'node:assert/strict'

const rate = 48000
const block = 1024

test('visualization preserves impulses between paint frames and uses audio time', () => {
  const history = new SignalHistory(rate)
  for (let n = 0; n < 190; n++) {
    const samples = new Float32Array(block)
    if (n === 80) samples[1] = 1 // deliberately between the old stride-four samples
    history.push(samples, (n + 1) * block / rate)
  }
  // No drawing occurred for four seconds. The event must still be present.
  const columns = history.columns(160)
  ok(columns.some(c => c?.peak === 1), 'short transient survives a slow display')
  const index = columns.findIndex(c => c?.peak === 1)
  const expected = Math.floor(80 * block / rate / 0.025) - (Math.ceil(history.end / 0.025) - 160)
  is(index, expected, 'position follows audio time, not a two-pixel minimum')
  const before = columns.map(c => c?.peak).join()
  is(history.columns(160).map(c => c?.peak).join(), before, 'painting does not advance the sweep')
})

test('scrolling translates completed signal columns without changing their width', () => {
  const history = new SignalHistory(rate)
  history.push(new Float32Array(block).fill(0.5), 0.09)
  const event = history.frames[0]
  for (let n = 0; n < 40; n++) {
    if (n) history.push(new Float32Array(block), 0.09 + n * block / rate)
    const indices = history.columns(160).flatMap((frame, i) => frame === event ? [i] : [])
    const first = Math.ceil(history.end / 0.025) - 160
    assert.deepEqual(indices, [2 - first, 3 - first], 'the transient remains exactly two fixed-time cells as it moves left')
    assert.deepEqual(history.columns(160).flatMap((frame, i) => frame === event ? [i] : []), indices, 'A → A paints the same footprint')
    is(event.rms, 0.5)
  }
})

test('fixed-time columns respect exact sample boundaries without phantom overlap', () => {
  const history = new SignalHistory(1000)
  const values = [0.25, 0.25, 0.5]
  for (let i = 0; i < values.length; i++) {
    history.push(new Float32Array(10).fill(values[i]), [0.05, 0.06, 0.07][i])
    const expected = [...Array(15 - i).fill(null), ...values.slice(0, i + 1)]
    assert.deepEqual(history.columns(16, 0.16).map(frame => frame?.peak ?? null), expected, 'A → A → B each occupies exactly one ten-sample cell')
    assert.deepEqual(history.columns(16, 0.16).map(frame => frame?.rms ?? null), expected, 'RMS shares the same exact cells')
  }
  const single = new SignalHistory(1000)
  single.push(new Float32Array(0), 0.05)
  assert.deepEqual(single.columns(16, 0.16), Array(16).fill(null), 'zero work does not advance the grid')
  single.push(new Float32Array([0.25]), 0.05)
  assert.deepEqual(single.columns(16, 0.16).map(frame => frame?.peak ?? null), [...Array(15).fill(null), 0.25], 'one sample immediately before the boundary')
  single.push(new Float32Array([0.5]), 0.051)
  assert.deepEqual(single.columns(16, 0.16).map(frame => frame?.peak ?? null), [...Array(14).fill(null), 0.25, 0.5], 'the next sample starts at the boundary without widening its predecessor')
})

test('visualization keeps bounded history and leaves capture gaps blank', () => {
  const history = new SignalHistory(rate)
  for (let n = 0; n < 500; n++) history.push(new Float32Array(block), (n + 1) * block / rate)
  ok(history.frames.length <= Math.ceil(rate * 4 / block) + 1, 'history cannot grow with playback duration')
  const end = history.end
  history.push(new Float32Array(block), end + 1)
  const columns = history.columns(160)
  ok(columns.slice(-35, -3).every(c => c === null), 'missing data is not drawn as silence')
  ok(columns.at(-1)?.peak === 0, 'captured silence is distinguishable from missing data')
})

test('history ignores zero work and stale timestamps; A → A → B has no stale spectrum', () => {
  const history = new SignalHistory(rate)
  is(history.columns(1)[0], null, 'empty history is missing data')
  history.push(new Float32Array(0), 1)
  is(history.version, 0, 'empty input cannot advance time or produce NaN RMS')
  history.push(new Float32Array([0.75]), 1 / rate)
  is(history.frames[0].peak, 0.75, 'smallest nonempty capture')
  is(history.frames[0].rms, 0.75)
  history.push(new Float32Array([1]), 1 / rate)
  history.push(new Float32Array([1]), 0)
  is(history.version, 1, 'duplicate and older deliveries do not rewrite history')
  for (const bin of [10, 10, 24]) {
    for (let n = 0; n < 2; n++) history.push(Float32Array.from({ length: block }, (_, i) => 0.05 * Math.sin(2 * Math.PI * bin * (n * block + i) / 2048)), history.end + block / rate)
    const frame = history.frames.at(-1)
    is(frame.spectrum.indexOf(Math.max(...frame.spectrum)), bin, 'new full FFT window determines frequency')
    ok(Math.abs(frame.rms - 0.05 / Math.sqrt(2)) < 1e-8, 'RMS is signal energy, not just nonempty data')
  }
  history.push(new Float32Array(block), history.end + 1)
  ok(history.frames.at(-1).spectrum.every(v => v === 0), 'capture gap clears the FFT overlap')
})

test('collector splits before and at the transfer boundary without losing final samples', () => {
  const { processor, messages, scope } = collector()
  processor.process([[new Float32Array(0)]])
  is(processor.offset, 0, 'zero-work input does not inject undefined samples')
  let offset = 0
  for (const length of [1, 1022, 1, 1024]) {
    scope.currentFrame = offset
    const samples = new Float32Array(length).fill(offset >= block ? -0.5 : 0.25)
    if (offset === 1023) samples[0] = 0.75
    processor.process([[samples]])
    offset += length
    is(messages.length, Math.floor(offset / block), 'only complete capture blocks are transferred')
  }
  assert.deepEqual([...messages[0].samples], [...new Float32Array(1023).fill(0.25), 0.75])
  ok(messages[1].samples.every(v => v === -0.5), 'A → B does not retain A samples')
  is(messages[0].end, 1024 / rate)
  is(messages[1].end, 2048 / rate)
  for (let n = 0; n < 8; n++) { scope.currentFrame = offset + n * 128; processor.process([]) }
  ok(messages[2].samples.every(v => v === 0), 'disconnected input is measured silence')
})

test('capture setup retries errors, shares loading, recycles buffers, and disposes once', async () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'AudioWorkletNode')
  let nodes = [], loads = 0, fail = false
  class Node {
    constructor() {
      this.port = { close: () => this.closed++, postMessage: (buffer, transfer) => { this.returned = structuredClone(buffer, { transfer }) } }
      this.closed = 0; this.disconnected = 0
      nodes.push(this)
    }
    disconnect() { this.disconnected++ }
  }
  globalThis.AudioWorkletNode = Node
  const source = { connect() { if (fail) throw Error('bad connection') }, disconnect() {} }
  const context = { sampleRate: rate, state: 'running', audioWorklet: { async addModule() { if (++loads === 1) throw Error('temporary load error') } } }
  try {
    is(await observeSignal({ sampleRate: rate }, source), null, 'no AudioWorklet capability')
    is(await observeSignal(context, source), null, 'load failure leaves playback caller in control')
    const a = await observeSignal(context, source), b = await observeSignal(context, source)
    is(loads, 2, 'retry succeeds; A → A shares successful module loading')
    const input = new Float32Array([0.5])
    nodes[0].port.onmessage({ data: { samples: input, end: 1 / rate } })
    is(input.byteLength, 0, 'message buffer really transfers back')
    is(a.history.frames[0].rms, 0.5, 'history owns the captured values before transfer')
    a.dispose(); a.dispose(); b.dispose()
    is(nodes[0].closed, 1); is(nodes[0].disconnected, 1)
    is(nodes[0].port.onmessage, null)
    fail = true
    is(await observeSignal(context, source), null)
    is(nodes[2].closed, 1, 'connect failure closes the newly allocated port')
    is(nodes[2].disconnected, 1)
    fail = false
    const c = await observeSignal(context, source)
    c.dispose()
    let finish
    const pending = { sampleRate: rate, state: 'running', audioWorklet: { addModule: () => new Promise(resolve => { finish = resolve }) } }
    const before = nodes.length, observation = observeSignal(pending, source)
    pending.state = 'closed'; finish()
    is(await observation, null, 'closing during module loading cannot create a capture node')
    is(nodes.length, before)
  } finally {
    if (saved) Object.defineProperty(globalThis, 'AudioWorkletNode', saved)
    else delete globalThis.AudioWorkletNode
  }
})

test('capture rechecks visibility after loading and recycles hidden deliveries without FFT work', async () => {
  const savedMedia = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia')
  const savedNode = Object.getOwnPropertyDescriptor(globalThis, 'AudioWorkletNode')
  const media = { matches: true }, nodes = []
  let loads = 0, finish, returned = 0
  globalThis.matchMedia = () => media
  globalThis.AudioWorkletNode = class {
    constructor() {
      this.closed = 0; this.disconnected = 0
      this.port = { close: () => this.closed++, postMessage: (buffer, transfer) => { structuredClone(buffer, { transfer }); returned++ } }
      nodes.push(this)
    }
    disconnect() { this.disconnected++ }
  }
  try {
    const { observeSignal: observe } = await import('../assets/signal.js?visibility-test')
    const context = { sampleRate: rate, state: 'running', audioWorklet: { addModule() { loads++; return new Promise(resolve => { finish = resolve }) } } }
    const source = { connect() {}, disconnect() {} }
    is(await observe(context, source), null)
    is(loads, 0, 'initially hidden capture does not load a module')
    media.matches = false
    const pending = observe(context, source)
    media.matches = true
    finish()
    is(await pending, null, 'hiding during loading cannot allocate a capture node')
    is(nodes.length, 0)
    media.matches = false
    const capture = await observe(context, source)
    is(loads, 1, 'visible retry reuses the completed module load')
    const send = (value, frame) => {
      const samples = new Float32Array([value])
      nodes[0].port.onmessage({ data: { samples, end: frame / rate } })
      is(samples.byteLength, 0, 'delivery is transferred back, even when hidden')
    }
    send(0.25, 1)
    capture.history.windowed.fill(NaN)
    media.matches = true
    send(0.75, 2)
    is(capture.history.version, 1, 'hidden input cannot change history')
    ok(capture.history.windowed.every(Number.isNaN), 'hidden input does not run FFT preparation')
    media.matches = false
    send(0.5, 3)
    assert.deepEqual(capture.history.frames.map(frame => frame.rms), [0.25, 0.5], 'visible A → hidden → visible B has no hidden values')
    is(returned, 3)
    capture.dispose(); capture.dispose()
    is(nodes[0].closed, 1); is(nodes[0].disconnected, 1)
  } finally {
    if (savedMedia) Object.defineProperty(globalThis, 'matchMedia', savedMedia)
    else delete globalThis.matchMedia
    if (savedNode) Object.defineProperty(globalThis, 'AudioWorkletNode', savedNode)
    else delete globalThis.AudioWorkletNode
  }
})

test('captured spectra place a known tone at its frequency', () => {
  const history = new SignalHistory(rate)
  for (let n = 0; n < 8; n++) history.push(Float32Array.from({ length: block }, (_, i) => 0.05 * Math.sin(2 * Math.PI * 440 * (n * block + i) / rate)), (n + 1) * block / rate)
  const spectrum = history.frames.at(-1).spectrum
  const peak = spectrum.indexOf(Math.max(...spectrum))
  ok(Math.abs(peak * rate / 2048 - 440) <= rate / 2048, 'spectral peak within one FFT bin')
  ok(history.frames.at(-1).rms > 0.03, 'level is computed from captured samples')
})

function collector() {
  let Processor, messages = []
  const scope = {
    Float32Array, currentFrame: 0, sampleRate: rate,
    AudioWorkletProcessor: class { constructor() { this.port = { postMessage: (data, transfer) => messages.push(structuredClone(data, { transfer })) } } },
    registerProcessor: (_, cls) => { Processor = cls },
  }
  vm.runInNewContext(readFileSync(new URL('../assets/signal-worklet.js', import.meta.url), 'utf8'), scope)
  return { processor: new Processor(), messages, scope }
}

test('audio-thread collector covers every quantum, timestamps blocks, and bounds pending transfers', () => {
  const { processor, messages, scope } = collector()
  for (let q = 0; q < 8; q++) {
    scope.currentFrame = q * 128
    const samples = new Float32Array(128)
    if (q === 2) samples[17] = 0.75
    processor.process([[samples]])
  }
  is(messages.length, 1)
  is(messages[0].end, block / rate)
  is(messages[0].samples[273], 0.75, 'every sample is captured')
  for (let q = 8; q < 1700; q++) { scope.currentFrame = q * 128; processor.process([[new Float32Array(128)]]) }
  is(messages.length, 192, 'a blocked main thread cannot grow the transfer queue indefinitely')
  processor.port.onmessage({ data: messages[0].samples.buffer })
  for (let q = 1700; q < 1708; q++) { scope.currentFrame = q * 128; processor.process([[new Float32Array(128)]]) }
  is(messages.length, 193, 'capture resumes when a transfer buffer is returned')
  is(messages.at(-1).end, 1708 * 128 / rate, 'a pause does not compress the audio timeline')
})
