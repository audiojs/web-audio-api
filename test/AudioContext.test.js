import test from 'tst'
import { is, ok, throws, almost } from 'tst'
import AudioContext from '../src/AudioContext.js'
import AudioNode from '../src/AudioNode.js'
import { BLOCK_SIZE } from '../src/constants.js'

let mkCtx = () => {
  let ctx = new AudioContext()
  ctx.outStream = { end() {} }
  return ctx
}

test('AudioContext > graph traversal collects all connected nodes', () => {
  let ctx = new AudioContext()
  ctx.outStream = { write() { return true }, once() {} }

  let n1a = new AudioNode(ctx, 2, 1)
  let n1b = new AudioNode(ctx, 0, 1)
  let n2a = new AudioNode(ctx, 2, 2)
  let n2b = new AudioNode(ctx, 1, 1)
  let n3a = new AudioNode(ctx, 1, 1)
  let n3b = new AudioNode(ctx, 0, 1)
  let n3c = new AudioNode(ctx, 1, 2)
  let n3d = new AudioNode(ctx, 2, 1)

  n1a.connect(ctx.destination)
  n1b.connect(ctx.destination)
  n2a.connect(n1a, 1, 0)
  n2b.connect(n1a)
  n3a.connect(n2a)
  n3b.connect(n2a)
  n3c.connect(n2a)
  n3d.connect(n2a, 0, 1)
  n3d.connect(n2b)

  let collectNodes = (node = ctx.destination, all = []) => {
    for (let input of node._inputs)
      for (let src of input.sources)
        if (!all.includes(src.node)) { all.push(src.node); collectNodes(src.node, all) }
    return all
  }
  is(collectNodes().length, 8)
})

test('AudioContext > destination is readonly', () => {
  let ctx = mkCtx(); ctx[Symbol.dispose]()
  throws(() => { ctx.destination = 'x' })
})

test('AudioContext > listener is readonly', () => {
  let ctx = mkCtx(); ctx[Symbol.dispose]()
  throws(() => { ctx.listener = 'x' })
})

test('AudioContext > currentTime is computed read-only getter', () => {
  let ctx = mkCtx(); ctx[Symbol.dispose]()
  is(ctx.currentTime, 0)
  throws(() => { ctx.currentTime = 999 })
})

test('AudioContext > sampleRate is read-only', () => {
  let ctx = mkCtx(); ctx[Symbol.dispose]()
  is(ctx.sampleRate, 44100)
  throws(() => { ctx.sampleRate = 999 })
})

test('AudioContext > sampleRate from constructor option', () => {
  let ctx = new AudioContext({ sampleRate: 48000 })
  ctx.outStream = { end() {} }; ctx[Symbol.dispose]()
  is(ctx.sampleRate, 48000)
})

// --- state machine ---

test('AudioContext > state starts as suspended (per spec)', () => {
  let ctx = mkCtx()
  is(ctx.state, 'suspended')
  ctx[Symbol.dispose]()
})

test('AudioContext > suspend/resume/close return Promises', async () => {
  let ctx = mkCtx()
  ok(ctx.suspend() instanceof Promise)
  ok(ctx.resume() instanceof Promise)
  ok(ctx.close() instanceof Promise)
})

test('AudioContext > suspend sets state to suspended', async () => {
  let ctx = mkCtx()
  await ctx.suspend()
  is(ctx.state, 'suspended')
  ctx[Symbol.dispose]()
})

test('AudioContext > resume sets state to running', async () => {
  let ctx = mkCtx()
  await ctx.suspend()
  await ctx.resume()
  is(ctx.state, 'running')
  ctx[Symbol.dispose]()
})

test('AudioContext > close sets state to closed', async () => {
  let ctx = mkCtx()
  await ctx.close()
  is(ctx.state, 'closed')
})

test('AudioContext > dispose sets state to closed', () => {
  let ctx = mkCtx()
  ctx[Symbol.dispose]()
  is(ctx.state, 'closed')
})

test('AudioContext > onstatechange fires', async () => {
  let ctx = mkCtx()
  let states = []
  ctx.onstatechange = () => states.push(ctx.state)
  await ctx.resume()
  await ctx.suspend()
  await ctx.resume()
  await ctx.close()
  is(states, ['running', 'suspended', 'running', 'closed'])
})

test('AudioContext > baseLatency and outputLatency', () => {
  let ctx = mkCtx(); ctx[Symbol.dispose]()
  almost(ctx.baseLatency, BLOCK_SIZE / 44100, 1e-10)
  almost(ctx.outputLatency, BLOCK_SIZE / 44100, 1e-10)
})

// --- render method ---

test('AudioContext > _renderLoop is overridable method', () => {
  let ctx = mkCtx(); ctx[Symbol.dispose]()
  is(typeof ctx._renderLoop, 'function')
})

test('AudioContext > render loop advances currentTime', async () => {
  let ctx = new AudioContext()
  await ctx.resume()
  let osc = ctx.createOscillator()
  osc.connect(ctx.destination)
  osc.start()
  // Wait for render loop to advance
  await new Promise(resolve => setTimeout(resolve, 200))
  ok(ctx.currentTime > 0, 'currentTime should advance, got ' + ctx.currentTime)
  ctx.close()
})

test('AudioContext > render loop emits error on failure', async () => {
  let ctx = new AudioContext()
  await ctx.resume()
  let osc = ctx.createOscillator()
  osc.connect(ctx.destination)
  osc.start()
  // Wait for loop to start
  await new Promise(resolve => setTimeout(resolve, 100))
  // Suppress console.error for this test
  let orig = console.error; console.error = () => {}
  // Break the render to trigger error
  ctx._renderQuantum = () => { throw new Error('test render error') }
  let error = await new Promise(resolve => {
    ctx.addEventListener('error', e => resolve(e.error))
    setTimeout(() => resolve(null), 500)
  })
  console.error = orig
  ok(error, 'error event should fire when render loop throws')
  ctx.close()
})

test('AudioContext > render loop does not outrun real-time after sources end', async () => {
  let ctx = new AudioContext()
  let frames = 0
  let origRQ = ctx._renderQuantum.bind(ctx)
  ctx._renderQuantum = function() { frames += 128; return origRQ() }

  await ctx.resume()
  // Short source: ends at 0.1s audio time
  let osc = ctx.createOscillator()
  osc.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + 0.1)

  // Wait 1s wall time
  await new Promise(r => setTimeout(r, 1000))
  ctx.close()

  let audioMs = frames / 44100 * 1000
  let ratio = audioMs / 1000
  // Should be ≤1.5x — not 3x+ which would mean ring buffer overwrite
  ok(ratio < 1.5, 'render ratio ' + ratio.toFixed(2) + 'x (must be <1.5x, was ' + audioMs.toFixed(0) + 'ms audio in 1000ms wall)')
})

test('AudioContext > real-time render produces continuous signal', async () => {
  // Verify the render loop produces a clean, continuous sine wave.
  // Checks frequency, amplitude, and quantum-boundary continuity.
  let { BLOCK_SIZE } = await import('../src/constants.js')

  let rtCtx = new AudioContext()
  let captured = []
  let origRQ = rtCtx._renderQuantum.bind(rtCtx)
  rtCtx._renderQuantum = function() {
    let buf = origRQ()
    captured.push(new Float32Array(buf.getChannelData(0)))
    return buf
  }

  await rtCtx.resume()
  let osc = rtCtx.createOscillator()
  osc.frequency.value = 440
  osc.connect(rtCtx.destination)
  osc.start()

  await new Promise(r => setTimeout(r, 300))
  rtCtx.close()

  ok(captured.length > 10, 'captured ' + captured.length + ' quanta')

  // Flatten
  let total = captured.length * BLOCK_SIZE
  let flat = new Float32Array(total)
  let off = 0
  for (let q of captured) { flat.set(q, off); off += q.length }

  // Skip leading silence (before oscillator starts)
  let start = 0
  while (start < total && flat[start] === 0) start++
  if (start >= total - 256) return ok(false, 'no signal detected')

  // Verify frequency via zero crossings
  let crossings = 0
  for (let i = start + 1; i < total; i++)
    if ((flat[i-1] <= 0 && flat[i] > 0) || (flat[i-1] >= 0 && flat[i] < 0)) crossings++
  let measuredFreq = crossings / 2 / ((total - start) / 44100)
  ok(Math.abs(measuredFreq - 440) < 5, 'frequency: ' + measuredFreq.toFixed(0) + 'Hz (expect 440)')

  // Verify continuity: no sample-to-sample jumps beyond sine max derivative
  let maxExpected = 2 * Math.PI * 440 / 44100 * 1.1
  let glitches = 0
  for (let i = start + 1; i < total; i++) {
    if (Math.abs(flat[i] - flat[i-1]) > maxExpected) glitches++
  }
  ok(glitches === 0, glitches + ' discontinuities in rendered output')
})
