// Shared benchmark scenarios — used by both Node.js and browser benchmarks
// Each scenario: { name, channels, setup(ctx) }

export const SR = 44100
export const DURATION = 1
export const LENGTH = SR * DURATION

/** @param {BaseAudioContext} ctx */
export const scenarios = [
  {
    name: 'silence (baseline)',
    channels: 1,
    setup: ctx => {}
  },
  {
    name: 'OscillatorNode',
    channels: 1,
    setup: ctx => {
      const o = ctx.createOscillator()
      o.connect(ctx.destination)
      o.start(0)
    }
  },
  {
    name: 'Osc → Gain',
    channels: 1,
    setup: ctx => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      g.gain.value = 0.5
      o.connect(g).connect(ctx.destination)
      o.start(0)
    }
  },
  {
    name: 'Osc → BiquadFilter',
    channels: 1,
    setup: ctx => {
      const o = ctx.createOscillator()
      const f = ctx.createBiquadFilter()
      f.frequency.value = 1000
      o.connect(f).connect(ctx.destination)
      o.start(0)
    }
  },
  {
    name: 'Osc → StereoPanner',
    channels: 2,
    setup: ctx => {
      const o = ctx.createOscillator()
      const p = ctx.createStereoPanner()
      p.pan.value = 0.5
      o.connect(p).connect(ctx.destination)
      o.start(0)
    }
  },
  {
    name: 'DynamicsCompressor',
    channels: 1,
    setup: ctx => {
      const o = ctx.createOscillator()
      const c = ctx.createDynamicsCompressor()
      o.connect(c).connect(ctx.destination)
      o.start(0)
    }
  },
  {
    name: 'ConvolverNode (128-tap IR)',
    channels: 1,
    setup: ctx => {
      const o = ctx.createOscillator()
      const c = ctx.createConvolver()
      c.normalize = false
      const ir = ctx.createBuffer(1, 128, SR)
      ir.getChannelData(0)[0] = 1
      c.buffer = ir
      o.connect(c).connect(ctx.destination)
      o.start(0)
    }
  },
  {
    name: 'Osc → Filter → Gain (chain)',
    channels: 1,
    setup: ctx => {
      const o = ctx.createOscillator()
      const f = ctx.createBiquadFilter()
      const g = ctx.createGain()
      o.connect(f).connect(g).connect(ctx.destination)
      o.start(0)
    }
  },
  {
    name: '8-voice polyphony',
    channels: 1,
    setup: ctx => {
      const mix = ctx.createGain()
      mix.connect(ctx.destination)
      for (let i = 0; i < 8; i++) {
        const o = ctx.createOscillator()
        o.frequency.value = 220 * (i + 1)
        o.connect(mix)
        o.start(0)
      }
    }
  }
]
