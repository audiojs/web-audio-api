import test from 'tst'
import { is, ok, almost, throws } from 'tst'
import AudioContext from '../src/AudioContext.js'
import { AudioWorkletNode, AudioWorkletProcessor } from '../src/AudioWorklet.js'
import AudioBuffer from 'audio-buffer'
import { fill } from 'audio-buffer/util'
import AudioNode from '../src/AudioNode.js'
import { BLOCK_SIZE } from '../src/constants.js'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import readWorkletModule from '../src/worklet-module.js'

let mkCtx = async () => {
  let ctx = new AudioContext()
  return ctx
}

test('AudioWorkletProcessor > base class has null port', () => {
  let p = new AudioWorkletProcessor()
  is(p.port, null, 'port is null before wiring')
  is(typeof p.process, 'undefined', 'no default process method')
})

test('AudioWorklet > register and instantiate processor', async () => {
  let ctx = await mkCtx()

  class GainProcessor extends AudioWorkletProcessor {
    process(inputs, outputs) {
      let inp = inputs[0][0], out = outputs[0][0]
      for (let i = 0; i < out.length; i++) out[i] = inp[i] * 0.5
      return true
    }
  }

  await ctx.audioWorklet.addModule((scope) => {
    scope.registerProcessor('gain-proc', GainProcessor)
  })

  let node = new AudioWorkletNode(ctx, 'gain-proc')
  ok(node, 'node created')
  ok(node.port, 'has port')
  is(node.parameters.size, 0, 'no custom params')
})

test('AudioWorklet > processes audio', async () => {
  let ctx = await mkCtx()

  class HalfGainProcessor extends AudioWorkletProcessor {
    process(inputs, outputs) {
      let inp = inputs[0]?.[0], out = outputs[0]?.[0]
      if (inp && out) for (let i = 0; i < out.length; i++) out[i] = inp[i] * 0.5
      return true
    }
  }

  await ctx.audioWorklet.addModule(scope => scope.registerProcessor('half', HalfGainProcessor))

  let node = new AudioWorkletNode(ctx, 'half')
  let src = new AudioNode(ctx, 0, 1)
  src.connect(node)
  src._tick = () => fill(new AudioBuffer(1, BLOCK_SIZE, 44100), 0.8)

  ctx._state = 'running'
  let buf = node._tick()
  almost(buf.getChannelData(0)[0], 0.4, 0.01, 'half gain applied')
})

test('AudioWorklet > custom parameters', async () => {
  let ctx = await mkCtx()

  class ParamProc extends AudioWorkletProcessor {
    static get parameterDescriptors() {
      return [{ name: 'gain', defaultValue: 0.5, automationRate: 'a-rate' }]
    }
    process(inputs, outputs, parameters) {
      let inp = inputs[0]?.[0], out = outputs[0]?.[0], gain = parameters.gain
      if (inp && out) for (let i = 0; i < out.length; i++) out[i] = inp[i] * gain[i]
      return true
    }
  }

  await ctx.audioWorklet.addModule(scope => scope.registerProcessor('param-proc', ParamProc))

  let node = new AudioWorkletNode(ctx, 'param-proc')
  is(node.parameters.size, 1, 'has 1 param')
  ok(node.parameters.get('gain'), 'gain param exists')
  almost(node.parameters.get('gain').value, 0.5, 1e-6, 'default 0.5')
})

test('AudioWorklet > process returning false kills node, outputs silence', async () => {
  let ctx = await mkCtx()
  let calls = 0

  class OneShot extends AudioWorkletProcessor {
    process(inputs, outputs) {
      calls++
      let out = outputs[0]?.[0]
      if (out) for (let i = 0; i < out.length; i++) out[i] = 1
      return calls < 3
    }
  }

  await ctx.audioWorklet.addModule(scope => scope.registerProcessor('oneshot', OneShot))

  let node = new AudioWorkletNode(ctx, 'oneshot')
  let src = new AudioNode(ctx, 0, 1)
  src.connect(node)
  src._tick = () => fill(new AudioBuffer(1, BLOCK_SIZE, 44100), 0)

  ctx._state = 'running'
  node._tick() // calls=1
  node._tick() // calls=2
  node._tick() // calls=3, returns false → killed
  is(calls, 3, 'process called 3 times')

  // subsequent tick: should output silence, process not called again
  let buf = node._tick()
  is(calls, 3, 'process not called after kill')
  ok(buf.getChannelData(0).every(v => v === 0), 'outputs silence after kill')
})

test('AudioWorklet > rejects duplicate registration', async () => {
  let ctx = await mkCtx()
  await ctx.audioWorklet.addModule(scope => {
    scope.registerProcessor('dup', AudioWorkletProcessor)
    throws(() => scope.registerProcessor('dup', AudioWorkletProcessor))
  })
})

test('AudioWorklet > rejects unregistered processor', async () => {
  let ctx = await mkCtx()
  await ctx.audioWorklet.addModule(() => {})
  throws(() => new AudioWorkletNode(ctx, 'nonexistent'))
})

test('AudioWorklet > addModule with data URI', async () => {
  let ctx = await mkCtx()

  await ctx.audioWorklet.addModule('data:text/javascript,' + encodeURIComponent(`
    class P extends AudioWorkletProcessor {
      process(_, outputs) { outputs[0][0].fill(0.42); return true }
    }; registerProcessor('data-uri-proc', P)
  `))

  let node = new AudioWorkletNode(ctx, 'data-uri-proc')
  let src = new AudioNode(ctx, 0, 1)
  src.connect(node)
  src._tick = () => fill(new AudioBuffer(1, BLOCK_SIZE, 44100), 0)

  ctx._state = 'running'
  let buf = node._tick()
  almost(buf.getChannelData(0)[0], 0.42, 0.01, 'data URI processor runs')
})

test('AudioWorklet > addModule with base64 data URI', async () => {
  let ctx = await mkCtx()
  let code = `class P extends AudioWorkletProcessor {
    process() { return true }
  }; registerProcessor('b64-proc', P)`

  await ctx.audioWorklet.addModule('data:text/javascript;base64,' + btoa(code))
  let node = new AudioWorkletNode(ctx, 'b64-proc')
  ok(node, 'base64 data URI works')
})

test('AudioWorklet > UTF-8 base64 decoding preserves names and output across A → A → B', async () => {
  for (const body of ['', 'Ow', 'Ow%3D%3D'])
    is(await readWorkletModule('data:text/javascript;base64,' + body), body ? ';' : '', 'empty and one-byte programs, with omitted or escaped final padding')
  is(await readWorkletModule('data:text/javascript;note=base64,;'), ';', 'a metadata value is not the base64 flag')
  await assert.rejects(readWorkletModule('data:;base64,Ow='), 'incomplete final padding is invalid')
  const ctx = await mkCtx()
  await ctx.audioWorklet.addModule('data:;base64,')
  for (const [name, value] of [['é音😀', 0.25], ['é音😀', 0.25], ['別', -0.5]]) {
    const code = `registerProcessor('${name}', class extends AudioWorkletProcessor { process(_, outputs) { outputs[0][0].fill(${value}); return true } })//終`
    const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(code)))
    await ctx.audioWorklet.addModule('data:text/javascript;base64,' + encodeURIComponent(encoded))
    const node = new AudioWorkletNode(ctx, name)
    ok(node._tick().getChannelData(0).every(v => v === value), 'decoded Unicode registration executes the correct program in every sample')
    ctx._frame += BLOCK_SIZE
  }
})

test('AudioWorklet > evaluation preserves nested strict functions, literal text, and final comments', async () => {
  const ctx = await mkCtx()
  for (const code of ['', ';', '//', '//終', '/*x*/']) {
    const url = 'data:text/javascript,' + encodeURIComponent(code)
    await ctx.audioWorklet.addModule(url); await ctx.audioWorklet.addModule(url)
  }
  const code = `"use strict";
    const text = \`prefix\n"use strict";\nsuffix\`;
    const moduleThis = this;
    function inheritedStrictThis() { return this; }
    function strictThis() {
"use strict";
      return this;
    }
    registerProcessor('preserved', class extends AudioWorkletProcessor {
      process(_, outputs) {
        outputs[0][0].fill(strictThis() === undefined ? 0.25 : -1);
        outputs[0][0][0] = text === 'prefix\\n"use strict";\\nsuffix' ? 0.5 : -1;
        if (moduleThis !== undefined) outputs[0][0][2] = -1;
        if (inheritedStrictThis() !== undefined) outputs[0][0][3] = -1;
        return true;
      }
    }); // final comment without a newline`
  await ctx.audioWorklet.addModule('data:text/javascript,' + encodeURIComponent(code))
  const output = new AudioWorkletNode(ctx, 'preserved')._tick().getChannelData(0)
  is(output[0], 0.5, 'template contents are not rewritten')
  ok(output.subarray(1).every(v => v === 0.25), 'module this, inherited strictness, and nested strict semantics survive evaluation')
})

test('AudioWorklet > addModule with blob URI', async () => {
  let ctx = await mkCtx()
  let code = `class P extends AudioWorkletProcessor {
    process() { return true }
  }; registerProcessor('blob-proc', P)`
  let url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))

  try {
    await ctx.audioWorklet.addModule(url)
    let node = new AudioWorkletNode(ctx, 'blob-proc')
    ok(node, 'blob URI works')
  } finally {
    URL.revokeObjectURL(url)
  }
})

test('AudioWorklet > empty, malformed, repeated and concurrent URL loads share their outcome', async () => {
  const ctx = await mkCtx()
  await ctx.audioWorklet.addModule('data:,')
  await ctx.audioWorklet.addModule('data:,') // zero-work A → A
  for (const input of [null, undefined, 0, {}, 'data:', 'data:,%', 'data:;base64,!', 'data:,class%20{']) {
    await assert.rejects(ctx.audioWorklet.addModule(input))
    await assert.rejects(ctx.audioWorklet.addModule(input), 'repeated failure cannot become success')
  }
  let finish, reads = 0, completed = false
  ctx._readModule = () => { reads++; return new Promise(resolve => { finish = resolve }) }
  const a = ctx.audioWorklet.addModule('pending.js')
  const b = ctx.audioWorklet.addModule('pending.js').then(() => { completed = true })
  await Promise.resolve(); await Promise.resolve()
  is(reads, 1, 'concurrent A → A performs one read')
  is(completed, false, 'second caller must wait for evaluation')
  finish(`registerProcessor('pending', class extends AudioWorkletProcessor { process() { return true } })`)
  await Promise.all([a, b])
  ok(new AudioWorkletNode(ctx, 'pending'))
  ctx._readModule = () => { reads++; return `registerProcessor('different', class extends AudioWorkletProcessor { process() { return true } })` }
  await ctx.audioWorklet.addModule('different.js')
  ok(new AudioWorkletNode(ctx, 'different'), 'A → B evaluates a different module')
  is(reads, 2)
  await assert.rejects(ctx.audioWorklet.addModule(() => { throw Error('setup failed') }), /setup failed/)
})

test('AudioWorklet > URL scope clocks remain live through consecutive quanta', async () => {
  const ctx = await mkCtx()
  const before = Object.getOwnPropertyDescriptor(globalThis, 'currentFrame')
  const code = `'use strict';
    registerProcessor('clock', class extends AudioWorkletProcessor {
      process(_, outputs) {
        const out = outputs[0][0]
        out.fill(currentFrame)
        out[0] = currentTime
        out[1] = sampleRate
        out[2] = Object.getPrototypeOf(_s) === null ? 1 : -1
        const d = Object.getOwnPropertyDescriptor(_s, 'currentTime')
        out[3] = d.enumerable && d.configurable && typeof d.get === 'function' && !d.set ? 1 : -1
        return true
      }
    })`
  await ctx.audioWorklet.addModule('data:text/javascript,' + encodeURIComponent(code))
  const node = new AudioWorkletNode(ctx, 'clock')
  for (const frame of [0, 128, 256]) {
    ctx._frame = frame
    const samples = node._tick().getChannelData(0)
    almost(samples[0], frame / ctx.sampleRate, 1e-7)
    is(samples[1], ctx.sampleRate)
    is(samples[2], 1, 'scope has no inherited names')
    is(samples[3], 1, 'clock descriptor semantics are unchanged')
    ok(samples.subarray(4).every(v => v === frame), 'clock changes affect every subsequent quantum')
  }
  assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'currentFrame'), before, 'no host-global pollution')
})

test('worklet host loader preserves relative and absolute paths and propagates read failures', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'waa-worklet-test-'))
  try {
    const file = join(dir, 'empty.js')
    writeFileSync(file, '')
    is(await readWorkletModule('empty.js', dir), '', 'smallest valid file is zero work')
    is(await readWorkletModule(file, '/nonexistent-base'), '', 'absolute path is not rebased')
    writeFileSync(file, '/* second contents */')
    is(await readWorkletModule(file, dir), '/* second contents */', 'reader itself does not cache stale contents')
    await assert.rejects(readWorkletModule('missing.js', dir), { code: 'ENOENT' })
    const ctx = await mkCtx()
    ctx._basePath = dir
    await ctx.audioWorklet.addModule('empty.js')
    await ctx.audioWorklet.addModule(file)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('AudioWorklet > message ports are entangled', async () => {
  let ctx = await mkCtx()
  await ctx.audioWorklet.addModule(scope => scope.registerProcessor('msg', AudioWorkletProcessor))
  let node = new AudioWorkletNode(ctx, 'msg')
  ok(node.port, 'node has port')
  ok(node.port !== null, 'port is not null')
})

test('AudioWorklet > parameterData seeds AudioParam initial value', async () => {
  let ctx = await mkCtx()

  class P extends AudioWorkletProcessor {
    static get parameterDescriptors() {
      return [
        { name: 'gain', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
        { name: 'pan',  defaultValue: 0,   minValue: -1, maxValue: 1, automationRate: 'a-rate' }
      ]
    }
    process() { return true }
  }
  await ctx.audioWorklet.addModule(scope => scope.registerProcessor('seeded', P))

  // Per spec: parameterData entries override the descriptor's defaultValue on the AudioParam.
  let node = new AudioWorkletNode(ctx, 'seeded', { parameterData: { gain: 0.25, pan: -0.5 } })
  almost(node.parameters.get('gain').value, 0.25, 1e-6, 'gain seeded from parameterData')
  almost(node.parameters.get('pan').value, -0.5, 1e-6, 'pan seeded from parameterData')

  // Unspecified params keep their descriptor default.
  let node2 = new AudioWorkletNode(ctx, 'seeded', { parameterData: { gain: 0.1 } })
  almost(node2.parameters.get('gain').value, 0.1, 1e-6, 'gain seeded')
  almost(node2.parameters.get('pan').value, 0, 1e-6, 'pan keeps default')
})

test('AudioWorklet > closure addModule exposes AudioWorkletProcessor on scope', async () => {
  let ctx = await mkCtx()
  let captured

  await ctx.audioWorklet.addModule(scope => {
    captured = scope
    // The same identifiers available in the URL/data-URI path must be reachable
    // here — otherwise users defining a class inside the closure must import
    // AudioWorkletProcessor themselves, which is a needless asymmetry.
    ok(typeof scope.AudioWorkletProcessor === 'function', 'AudioWorkletProcessor on scope')
    ok(typeof scope.registerProcessor === 'function', 'registerProcessor on scope')
    is(scope.sampleRate, ctx.sampleRate, 'sampleRate on scope')
    ok('currentTime' in scope, 'currentTime on scope')
    ok('currentFrame' in scope, 'currentFrame on scope')

    class P extends scope.AudioWorkletProcessor {
      process() { return true }
    }
    scope.registerProcessor('via-scope', P)
  })

  let node = new AudioWorkletNode(ctx, 'via-scope')
  ok(node, 'node created from class extending scope.AudioWorkletProcessor')

  // currentTime must read live from context, not be a snapshot
  ctx._frame = 1234
  is(captured.currentFrame, ctx._frame, 'currentFrame is live')
})
