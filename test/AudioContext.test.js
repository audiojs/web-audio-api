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

test('AudioContext > state starts as running', () => {
  let ctx = mkCtx(); ctx[Symbol.dispose]()
  // dispose sets state to closed, so check before dispose
  let ctx2 = mkCtx()
  is(ctx2.state, 'running')
  ctx2[Symbol.dispose]()
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
  await ctx.suspend()
  await ctx.resume()
  await ctx.close()
  is(states, ['suspended', 'running', 'closed'])
})

test('AudioContext > baseLatency and outputLatency', () => {
  let ctx = mkCtx(); ctx[Symbol.dispose]()
  almost(ctx.baseLatency, BLOCK_SIZE / 44100, 1e-10)
  almost(ctx.outputLatency, BLOCK_SIZE / 44100, 1e-10)
})

// --- render method ---

test('AudioContext > _render is overridable method', () => {
  let ctx = mkCtx(); ctx[Symbol.dispose]()
  is(typeof ctx._render, 'function')
  is(typeof ctx._renderLoop, 'function')
})
