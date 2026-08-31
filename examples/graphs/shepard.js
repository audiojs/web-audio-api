// Shepard tone: Layer octave-spaced voices to create a pitch that appears to rise or fall forever.
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function result({ sources = [], nodes = [], duration = 3, graph, data } = {}) {
  return { sources, nodes, duration, graph, data }
}

export const processorSource = `class ShepardProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    const { direction, rate, sampleRate } = options.processorOptions
    this.sign = direction === 'down' ? -1 : 1
    this.rate = rate
    this.sampleRate = sampleRate
    this.phases = new Float64Array(8)
    this.time = 0
    this.port.onmessage = ({ data }) => {
      if (data.direction) this.sign = data.direction === 'down' ? -1 : 1
      if (data.rate != null) this.rate = data.rate
    }
  }
  process(inputs, outputs) {
    const output = outputs[0][0]
    for (let i = 0; i < output.length; i++) {
      this.time += 1 / this.sampleRate
      let sample = 0
      for (let octave = 0; octave < 8; octave++) {
        const phase = ((octave / 8 + this.sign * this.rate / 8 * this.time) % 1 + 1) % 1
        const offset = phase * 8 - 4
        const frequency = 440 * 2 ** offset
        const amplitude = Math.exp(-0.5 * (offset / 2) ** 2)
        this.phases[octave] += frequency / this.sampleRate
        sample += Math.sin(2 * Math.PI * this.phases[octave]) * amplitude
      }
      output[i] = sample * 0.12
    }
    return true
  }
}
registerProcessor('shepard', ShepardProcessor)`

export async function build(ctx, {
  direction = 'up', rate = 0.5, duration = 30, when = ctx.currentTime,
  destination = ctx.destination, AudioWorkletNodeClass = null,
} = {}) {
  if (!AudioWorkletNodeClass) throw new TypeError('AudioWorkletNode is not available')
  await ctx.audioWorklet.addModule(`data:text/javascript,${encodeURIComponent(processorSource)}`)
  let node = new AudioWorkletNodeClass(ctx, 'shepard', {
    processorOptions: { direction, rate, sampleRate: ctx.sampleRate },
  })
  let master = ctx.createGain()
  node.connect(master).connect(destination)
  let end = when + duration
  master.gain.setValueAtTime(1, Math.max(when, end - Math.min(1, duration / 3)))
  master.gain.linearRampToValueAtTime(0, end)
  return result({ sources: [node], nodes: [node, master], duration, graph: 'AudioWorklet Shepard bank → Gain → Destination', data: { node } })
}
