// Custom AudioWorklet: Register a custom processor, expose a parameter, and render its output.
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

export const processorSource = `class WhiteNoise extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [{ name: 'amplitude', defaultValue: 0.18, minValue: 0, maxValue: 1 }] }
  process(inputs, outputs, parameters) {
    const output = outputs[0][0]
    const amplitude = parameters.amplitude
    for (let i = 0; i < output.length; i++) output[i] = (Math.random() * 2 - 1) * amplitude[Math.min(i, amplitude.length - 1)]
    return true
  }
}
registerProcessor('white-noise', WhiteNoise)`

export async function build(ctx, {
  duration = 1, gain = 0.18, when = ctx.currentTime, destination = ctx.destination,
  AudioWorkletNodeClass = null,
} = {}) {
  let url = URL.createObjectURL(new Blob([processorSource], { type: 'text/javascript' }))
  try { await ctx.audioWorklet.addModule(url) } finally { URL.revokeObjectURL(url) }
  if (!AudioWorkletNodeClass) throw new TypeError('AudioWorkletNode is not available')
  let node = new AudioWorkletNodeClass(ctx, 'white-noise')
  let amplitude = node.parameters.get('amplitude')
  amplitude.setValueAtTime(0, when)
  amplitude.linearRampToValueAtTime(gain, when + Math.min(0.2, duration / 3))
  amplitude.linearRampToValueAtTime(0, when + duration)
  node.connect(destination)
  return { sources: [], nodes: [node], duration, graph: 'AudioWorkletProcessor → AudioWorkletNode → Destination' }
}
