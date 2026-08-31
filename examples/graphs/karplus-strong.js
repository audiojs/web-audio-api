// Karplus–Strong string: Turn a short noise burst and averaging delay into a plucked string.
// CLI: node examples/karplus-strong.js A4 4s
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

export const processorSource = `class KarplusStrongProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.sampleRateValue = options.processorOptions.sampleRate
    this.pluck(options.processorOptions.frequency)
    this.port.onmessage = ({ data }) => { if (data.frequency) this.pluck(data.frequency) }
  }
  pluck(frequency) {
    this.length = Math.max(2, Math.round(this.sampleRateValue / frequency))
    this.buffer = new Float32Array(this.length)
    for (let i = 0; i < this.length; i++) this.buffer[i] = Math.random() * 2 - 1
    this.position = 0
  }
  process(inputs, outputs) {
    const output = outputs[0][0]
    for (let i = 0; i < output.length; i++) {
      const next = (this.position + 1) % this.length
      this.buffer[this.position] = (this.buffer[this.position] + this.buffer[next]) * 0.498
      output[i] = this.buffer[this.position]
      this.position = next
    }
    return true
  }
}
registerProcessor('karplus-strong', KarplusStrongProcessor)`

export async function build(ctx, {
  frequency = 220, duration = 30, gain = 0.5, when = ctx.currentTime,
  destination = ctx.destination, AudioWorkletNodeClass = null,
} = {}) {
  if (!AudioWorkletNodeClass) throw new TypeError('AudioWorkletNode is not available')
  await ctx.audioWorklet.addModule(`data:text/javascript,${encodeURIComponent(processorSource)}`)
  let node = new AudioWorkletNodeClass(ctx, 'karplus-strong', {
    processorOptions: { frequency, sampleRate: ctx.sampleRate },
  })
  let master = ctx.createGain()
  master.gain.value = gain
  node.connect(master).connect(destination)
  let end = when + duration
  master.gain.setValueAtTime(gain, Math.max(when, end - Math.min(0.1, duration / 4)))
  master.gain.linearRampToValueAtTime(0, end)
  return { sources: [node], nodes: [node, master], duration, graph: 'Karplus–Strong AudioWorklet → Gain → Destination', data: { node } }
}
