import { observeSignal } from './signal.js'

export class AudioContext extends globalThis.AudioContext {
  constructor(...args) {
    super(...args)
    this.nodes = new Set()
    this.tap = new AnalyserNode(this, { fftSize: 2048 })
    this.level = new GainNode(this)
    this.tap.connect(this.level).connect(super.destination)
    this.capture = observeSignal(this, this.tap)
    dispatchEvent(new CustomEvent('audiocontext', { detail: this }))
  }
  get destination() { return this.tap }
  async resume() {
    await super.resume()
    // Capture is ready before hero.js schedules its one-sample excitation.
    await this.capture
  }
  async close() {
    const capture = await this.capture
    capture?.dispose()
    this.nodes.clear()
    if (this.state !== 'closed') return super.close()
  }
}

// Keep feedback nodes alive after their excitation source ends.
const { connect } = AudioNode.prototype
AudioNode.prototype.connect = function (...args) {
  if (this.context instanceof AudioContext) this.context.nodes.add(this)
  return connect.apply(this, args)
}
