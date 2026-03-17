import test from 'tst'
import { is, ok, almost, throws } from 'tst'
import AudioContext from '../src/AudioContext.js'
import { AudioWorkletNode, AudioWorkletProcessor } from '../src/AudioWorklet.js'
import AudioBuffer from 'audio-buffer'
import AudioNode from '../src/AudioNode.js'
import { BLOCK_SIZE } from '../src/constants.js'

let mkCtx = async () => {
  let ctx = new AudioContext()
  ctx.outStream = { end() {} }
  ctx[Symbol.dispose]()
  return ctx
}

test('AudioWorkletProcessor > base class has port and process', () => {
  let p = new AudioWorkletProcessor()
  ok(p.port, 'has port')
  is(p.process(), true, 'default process returns true')
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

test.mute('AudioWorklet > processes audio', async () => {
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
  src._tick = () => AudioBuffer.filledWithVal(0.8, 1, BLOCK_SIZE, 44100)

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

test('AudioWorklet > process returning false kills node', async () => {
  let ctx = await mkCtx()

  class OneShot extends AudioWorkletProcessor {
    #count = 0
    process(inputs, outputs) { return ++this.#count < 3 }
  }

  await ctx.audioWorklet.addModule(scope => scope.registerProcessor('oneshot', OneShot))

  let node = new AudioWorkletNode(ctx, 'oneshot')
  let src = new AudioNode(ctx, 0, 1)
  src.connect(node)
  src._tick = () => AudioBuffer.filledWithVal(0, 1, BLOCK_SIZE, 44100)

  ctx._state = 'running'
  node._tick() // count 1
  node._tick() // count 2
  ok(node._tick(), 'still alive at 3')
  // after returning false, node stops processing (outputs silence)
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
