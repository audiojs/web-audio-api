import { observeSignal } from './signal.js'

export class PreviewContext extends globalThis.AudioContext {
  #cancelCapture
  #stopped = false
  #closing
  #resuming = Promise.resolve()

  constructor(...args) {
    super(...(args.length ? args : [{ sampleRate: 44100 }]))
    this.nodes = new Set()
    this.tap = new AnalyserNode(this, { fftSize: 2048 })
    this.level = new GainNode(this)
    this.tap.connect(this.level).connect(super.destination)
    this.capture = new Promise(resolve => {
      this.#cancelCapture = () => resolve(null)
      observeSignal(this, this.tap).then(capture => {
        if (this.#stopped) capture?.dispose()
        resolve(capture)
      })
    })
  }
  get destination() { return this.tap }
  async resume() {
    if (this.#stopped) throw new DOMException('Preview stopped', 'AbortError')
    await (this.#resuming = super.resume())
    // Capture is ready before hero.js schedules its one-sample excitation.
    await this.capture
    if (this.#stopped) throw new DOMException('Preview stopped', 'AbortError')
  }
  async close() {
    if (this.#stopped) return this.#closing
    this.#stopped = true
    this.#cancelCapture()
    this.capture.then(capture => capture?.dispose())
    this.nodes.clear()
    // WebKit can reopen an output when close overtakes an outstanding resume.
    // Finish the native resume before closing; capture setup is cancelled above.
    this.#closing = this.#resuming.catch(() => {}).then(() => {
      if (this.state !== 'closed') return super.close()
    })
    return this.#closing
  }
}

export class AudioContext extends PreviewContext {
  constructor(...args) {
    super(...args)
    dispatchEvent(new CustomEvent('audiocontext', { detail: this }))
  }
}

// Keep feedback nodes alive after their excitation source ends.
const { connect } = AudioNode.prototype
AudioNode.prototype.connect = function (...args) {
  if (this.context instanceof PreviewContext) this.context.nodes.add(this)
  return connect.apply(this, args)
}
