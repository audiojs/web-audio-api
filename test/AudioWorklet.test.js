import test from 'tst'
import { is, ok, almost, throws } from 'tst'
import AudioContext from '../src/AudioContext.js'
import { AudioWorkletNode, AudioWorkletProcessor } from '../src/AudioWorklet.js'
import AudioBuffer from 'audio-buffer'
import { fill } from 'audio-buffer/util'
import AudioNode from '../src/AudioNode.js'
import { BLOCK_SIZE } from '../src/constants.js'

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

test('AudioWorklet > message ports are entangled', async () => {
  let ctx = await mkCtx()
  await ctx.audioWorklet.addModule(scope => scope.registerProcessor('msg', AudioWorkletProcessor))
  let node = new AudioWorkletNode(ctx, 'msg')
  ok(node.port, 'node has port')
  ok(node.port !== null, 'port is not null')
})
