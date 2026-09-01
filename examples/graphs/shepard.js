// Shepard tone: Layer octave-spaced voices to create a pitch that appears to rise or fall forever.
// CLI: npx web-audio-api shepard up 15s
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

export const processorSource = `class ShepardProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    const { direction, rate, sampleRate, wave } = options.processorOptions
    this.sign = direction === 'down' ? -1 : 1
    this.rate = rate
    this.sampleRate = sampleRate
    this.wave = wave || 'sine'
    this.phases = new Float64Array(11)
    this.time = 0
    this.port.onmessage = ({ data }) => {
      if (data.direction) this.sign = data.direction === 'down' ? -1 : 1
      if (data.rate != null) this.rate = data.rate
      if (data.wave) this.wave = data.wave
    }
  }
  process(inputs, outputs) {
    const output = outputs[0][0]
    for (let i = 0; i < output.length; i++) {
      this.time += 1 / this.sampleRate
      let sample = 0
      for (let octave = 0; octave < 11; octave++) {
        const phase = ((octave / 11 + this.sign * this.rate / 11 * this.time) % 1 + 1) % 1
        const offset = phase * 11 - 5.5
        const frequency = 440 * 2 ** offset
        if (frequency > this.sampleRate / 2) continue
        const amplitude = Math.exp(-0.5 * (offset / 2) ** 2)
        this.phases[octave] += frequency / this.sampleRate
        const p = this.phases[octave] % 1
        const value = this.wave === 'square' ? (p < 0.5 ? 1 : -1)
          : this.wave === 'sawtooth' ? 2 * p - 1
          : this.wave === 'triangle' ? 2 * Math.abs(2 * p - 1) - 1
          : Math.sin(2 * Math.PI * this.phases[octave])
        sample += value * amplitude
      }
      output[i] = sample * 0.12
    }
    return true
  }
}
registerProcessor('shepard', ShepardProcessor)`

export async function init(ctx, {
  direction = 'up', rate = 0.5, wave = 'sine', duration = 30, when = ctx.currentTime,
  destination = ctx.destination, AudioWorkletNodeClass = null,
} = {}) {
  if (!AudioWorkletNodeClass) throw new TypeError('AudioWorkletNode is not available')
  await ctx.audioWorklet.addModule(`data:text/javascript,${encodeURIComponent(processorSource)}`)
  let node = new AudioWorkletNodeClass(ctx, 'shepard', {
    processorOptions: { direction, rate, wave, sampleRate: ctx.sampleRate },
  })
  let master = ctx.createGain()
  node.connect(master).connect(destination)
  let end = when + duration
  master.gain.setValueAtTime(1, Math.max(when, end - Math.min(1, duration / 3)))
  master.gain.linearRampToValueAtTime(0, end)
  return { sources: [node], nodes: [node, master], duration, graph: 'AudioWorklet Shepard bank → Gain → Destination', data: { node } }
}
