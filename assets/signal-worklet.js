// Capture every sample independently of the display frame rate. No audible output.
class SignalCapture extends AudioWorkletProcessor {
  constructor() {
    super()
    this.samples = new Float32Array(1024)
    this.offset = 0
    this.pool = []
    this.allocated = 1
    this.port.onmessage = ({ data }) => this.pool.push(new Float32Array(data))
  }

  process(inputs) {
    if (!this.samples) {
      this.samples = this.pool.pop()
      if (!this.samples) return true
    }
    const input = inputs[0]?.[0]
    const length = input?.length ?? 128
    for (let i = 0; i < length; i++) {
      this.samples[this.offset++] = input ? input[i] : 0
      if (this.offset === this.samples.length) {
        this.port.postMessage({ samples: this.samples, end: (currentFrame + i + 1) / sampleRate }, [this.samples.buffer])
        this.samples = this.pool.pop() || (this.allocated < 192 ? (this.allocated++, new Float32Array(1024)) : null)
        this.offset = 0
        if (!this.samples) break
      }
    }
    return true
  }
}
registerProcessor('site-signal', SignalCapture)
