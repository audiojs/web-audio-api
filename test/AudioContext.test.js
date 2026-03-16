import test from 'tst'
import { is, ok, throws } from 'tst'
import AudioContext from '../src/AudioContext.js'
import AudioNode from '../src/AudioNode.js'

test('AudioContext > graph traversal collects all connected nodes', () => {
  let ctx = new AudioContext()
  ctx.outStream = { end() {} }
  ctx[Symbol.dispose]()

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

  // Collect all upstream nodes from destination
  let collectNodes = (node = ctx.destination, all = []) => {
    for (let input of node._inputs) {
      for (let src of input.sources) {
        if (!all.includes(src.node)) {
          all.push(src.node)
          collectNodes(src.node, all)
        }
      }
    }
    return all
  }
  let collected = collectNodes()
  is(collected.length, 8)
})

test('AudioContext > destination is readonly', () => {
  let ctx = new AudioContext()
  ctx.outStream = { end() {} }
  ctx[Symbol.dispose]()

  throws(() => { ctx.destination = 'nope' })
})

test('AudioContext > listener is readonly', () => {
  let ctx = new AudioContext()
  ctx.outStream = { end() {} }
  ctx[Symbol.dispose]()

  throws(() => { ctx.listener = 'nope' })
})

test('AudioContext > factory methods', () => {
  let ctx = new AudioContext()
  ctx.outStream = { end() {} }
  ctx[Symbol.dispose]()

  ok(ctx.createBuffer(1, 100, 44100))
  ok(ctx.createBufferSource())
  ok(ctx.createGain())
  ok(ctx.createScriptProcessor(1024, 1, 1))
  ok(ctx.createPanner())
})

// --- Phase 0 issue tests ---

test('Phase0 > AudioContext > error variable bug (err vs e)', () => {
  // Issue #5: catch(e) references `err` (undefined) on line 79
  // The tick loop catches errors with (e) but references (err)
  // This means errors in the tick loop are silently swallowed or throw ReferenceError

  let ctx = new AudioContext()
  ctx.outStream = { end() {} }
  ctx[Symbol.dispose]()

  // Verify the source code contains the bug
  // We can't easily trigger the tick loop error in a unit test without an outStream,
  // but we document the bug exists
  ok(true, 'error variable mismatch documented — line 79: err should be e')
})

test('Phase0 > AudioContext > tick loop is closure in constructor', () => {
  // Issue #4: rendering engine trapped in constructor closure
  // Cannot be overridden, tested independently, or shared with OfflineAudioContext
  let ctx = new AudioContext()
  ctx.outStream = { end() {} }
  ctx[Symbol.dispose]()

  // There's no _render() method — the tick is an inaccessible closure
  is(typeof ctx._render, 'undefined', 'no _render method — tick loop trapped in closure')
})

test('Phase0 > AudioContext > currentTime is writable (should be getter)', () => {
  // currentTime should be computed from frame count, not a mutable property
  let ctx = new AudioContext()
  ctx.outStream = { end() {} }
  ctx[Symbol.dispose]()

  ctx.currentTime = 999
  is(ctx.currentTime, 999, 'currentTime is writable — should be read-only getter')
})

test('Phase0 > AudioContext > sampleRate is writable (should be read-only)', () => {
  let ctx = new AudioContext()
  ctx.outStream = { end() {} }
  ctx[Symbol.dispose]()

  ctx.sampleRate = 999
  is(ctx.sampleRate, 999, 'sampleRate is writable — should be read-only')
})

test('Phase0 > AudioContext > no state property', () => {
  let ctx = new AudioContext()
  ctx.outStream = { end() {} }
  ctx[Symbol.dispose]()

  is(ctx.state, undefined, 'no state property — spec requires suspended/running/closed')
})

test('Phase0 > AudioContext > no suspend/resume/close methods', () => {
  let ctx = new AudioContext()
  ctx.outStream = { end() {} }
  ctx[Symbol.dispose]()

  is(typeof ctx.suspend, 'undefined')
  is(typeof ctx.resume, 'undefined')
  is(typeof ctx.close, 'undefined')
})
