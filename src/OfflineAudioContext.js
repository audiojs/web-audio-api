import BaseAudioContext from './BaseAudioContext.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'
import { DOMErr } from './errors.js'

class OfflineAudioContext extends BaseAudioContext {
  #length
  #numberOfChannels
  #renderedBuffer = null
  #suspendPoints = new Map()  // frame -> [resolve callbacks]
  #outBuf = null
  #written = 0
  #renderResolve = null
  #renderReject = null
  #rendering = false  // true when inside startRendering
  #renderQuantumSize

  get length() { return this.#length }
  get renderQuantumSize() { return this.#renderQuantumSize }

  constructor(numberOfChannels, length, sampleRate) {
    let renderSizeHint
    // Support options dict form: new OfflineAudioContext({numberOfChannels, length, sampleRate})
    if (typeof numberOfChannels === 'object') {
      let opts = numberOfChannels
      numberOfChannels = opts.numberOfChannels || 1
      length = opts.length
      sampleRate = opts.sampleRate
      renderSizeHint = opts.renderSizeHint
    }

    // Validate required parameters
    if (length === undefined || sampleRate === undefined)
      throw new TypeError("Failed to construct 'OfflineAudioContext': required members are missing.")

    // Validate parameter ranges
    if (numberOfChannels < 1 || numberOfChannels > 32) throw DOMErr('numberOfChannels must be between 1 and 32', 'NotSupportedError')
    if (!(length >= 1)) throw DOMErr('length must be >= 1', 'NotSupportedError')
    if (sampleRate < 3000 || sampleRate > 768000) throw DOMErr('sampleRate must be between 3000 and 768000', 'NotSupportedError')

    // Validate renderSizeHint
    let renderQuantumSize = BLOCK_SIZE
    if (renderSizeHint !== undefined) {
      if (renderSizeHint === 'default' || renderSizeHint === 'hardware') {
        renderQuantumSize = BLOCK_SIZE
      } else if (typeof renderSizeHint === 'number') {
        let maxSize = sampleRate * 6
        if (renderSizeHint < 1 || renderSizeHint > maxSize)
          throw DOMErr("Failed to construct 'OfflineAudioContext': renderSizeHint " + renderSizeHint + " is out of range.", 'NotSupportedError')
        renderQuantumSize = renderSizeHint
      }
    }

    super(sampleRate, numberOfChannels)
    this.#numberOfChannels = numberOfChannels
    this.#length = length
    this.#renderQuantumSize = renderQuantumSize
  }

  startRendering() {
    if (this._state === 'closed') return Promise.reject(new Error('context is closed'))

    return new Promise((resolve, reject) => {
      this.#renderResolve = resolve
      this.#renderReject = reject
      this.#outBuf = new AudioBuffer(this.#numberOfChannels, this.#length, this.sampleRate)
      this.#written = 0
      this.#rendering = true
      this._setState('running')
      this._continueRendering()
    })
  }

  _continueRendering() {
    try {
      while (this.#written < this.#length) {
        // Check for suspend point at current frame (before rendering this quantum)
        let suspendCallbacks = this.#suspendPoints.get(this._frame)
        if (suspendCallbacks) {
          this.#suspendPoints.delete(this._frame)
          this._setState('suspended')
          for (let cb of suspendCallbacks) cb()
          return // Wait for resume() to continue
        }

        let block = this._renderQuantum()
        let remaining = this.#length - this.#written
        let count = Math.min(BLOCK_SIZE, remaining)

        for (let ch = 0; ch < this.#numberOfChannels; ch++) {
          let src = block.getChannelData(Math.min(ch, block.numberOfChannels - 1))
          let dst = this.#outBuf.getChannelData(ch)
          for (let i = 0; i < count; i++) dst[this.#written + i] = src[i]
        }

        this.#written += count
      }

      this.#renderedBuffer = this.#outBuf
      this._frame = Math.ceil(this.#length / BLOCK_SIZE) * BLOCK_SIZE
      this._setState('closed')
      let ev = new Event('complete')
      ev.renderedBuffer = this.#outBuf
      this.dispatchEvent(ev)
      this.#renderResolve(this.#outBuf)
    } catch (e) {
      this._setState('closed')
      this.#renderReject(e)
    }
  }

  suspend(suspendTime) {
    if (this._state === 'closed') return Promise.reject(DOMErr('context is closed', 'InvalidStateError'))
    if (suspendTime === undefined || typeof suspendTime !== 'number' || suspendTime < 0)
      return Promise.reject(DOMErr('suspendTime is required and must be non-negative', 'InvalidStateError'))

    // Quantize to render quantum boundary (spec: round up)
    let suspendFrame = Math.ceil(suspendTime * this.sampleRate / BLOCK_SIZE) * BLOCK_SIZE

    return new Promise(resolve => {
      let list = this.#suspendPoints.get(suspendFrame)
      if (!list) { list = []; this.#suspendPoints.set(suspendFrame, list) }
      list.push(resolve)
    })
  }

  resume() {
    if (this._state === 'closed') return Promise.reject(DOMErr('context is closed', 'InvalidStateError'))
    if (!this.#rendering || this._state !== 'suspended')
      return Promise.reject(DOMErr('cannot resume: not in a rendering suspend', 'InvalidStateError'))
    this._setState('running')
    // Use microtask to allow current stack to unwind before continuing
    return new Promise(resolve => {
      queueMicrotask(() => {
        this._continueRendering()
        resolve()
      })
    })
  }

  get renderedBuffer() { return this.#renderedBuffer }
}

export default OfflineAudioContext
