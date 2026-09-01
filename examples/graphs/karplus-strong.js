// Karplus–Strong: Turn a short noise burst and averaging delay into a plucked string.
// CLI: npx web-audio-api karplus-strong A4 4s
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

export const processorSource = `class KarplusStrongProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.sampleRateValue = options.processorOptions.sampleRate
    this.decay = options.processorOptions.decay || 4
    this.pluck(options.processorOptions.frequency)
    this.port.onmessage = ({ data }) => {
      if (data.decay) this.decay = data.decay
      if (data.frequency) this.pluck(data.frequency)
    }
  }
  pluck(frequency) {
    this.length = Math.max(2, Math.round(this.sampleRateValue / frequency))
    this.buffer = new Float32Array(this.length)
    for (let i = 0; i < this.length; i++) this.buffer[i] = Math.random() * 2 - 1
    this.position = 0
    // loop gain per period reaches -60 dB after decay seconds
    this.factor = Math.min(0.4995, 0.001 ** (1 / (frequency * this.decay)) / 2)
  }
  process(inputs, outputs) {
    const output = outputs[0][0]
    for (let i = 0; i < output.length; i++) {
      const next = (this.position + 1) % this.length
      this.buffer[this.position] = (this.buffer[this.position] + this.buffer[next]) * this.factor
      output[i] = this.buffer[this.position]
      this.position = next
    }
    return true
  }
}
registerProcessor('karplus-strong', KarplusStrongProcessor)`

export async function init(ctx, {
  frequency = 220, decay = 4, duration = 30, gain = 0.5, when = ctx.currentTime,
  destination = ctx.destination, AudioWorkletNodeClass = null,
} = {}) {
  if (!AudioWorkletNodeClass) throw new TypeError('AudioWorkletNode is not available')
  await ctx.audioWorklet.addModule(`data:text/javascript,${encodeURIComponent(processorSource)}`)
  let node = new AudioWorkletNodeClass(ctx, 'karplus-strong', {
    processorOptions: { frequency, decay, sampleRate: ctx.sampleRate },
  })
  let master = ctx.createGain()
  master.gain.value = gain
  node.connect(master).connect(destination)
  let end = when + duration
  master.gain.setValueAtTime(gain, Math.max(when, end - Math.min(0.1, duration / 4)))
  master.gain.linearRampToValueAtTime(0, end)
  return { sources: [node], nodes: [node, master], duration, graph: 'Karplus–Strong AudioWorklet → Gain → Destination', data: { node } }
}
