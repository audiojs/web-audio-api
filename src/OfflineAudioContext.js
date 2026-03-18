import BaseAudioContext from './BaseAudioContext.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'


class OfflineAudioContext extends BaseAudioContext {
  #length
  #numberOfChannels
  #renderedBuffer = null

  get length() { return this.#length }

  constructor(numberOfChannels, length, sampleRate) {
    let _NotSupported = globalThis.DOMException
      ? (msg) => new DOMException(msg, 'NotSupportedError')
      : (msg) => { let e = new Error(msg); e.name = 'NotSupportedError'; return e }

    // Support options dict form: new OfflineAudioContext({numberOfChannels, length, sampleRate})
    if (typeof numberOfChannels === 'object') {
      let opts = numberOfChannels
      numberOfChannels = opts.numberOfChannels || 1
      length = opts.length
      sampleRate = opts.sampleRate
    }

    // Validate required parameters
    if (length === undefined || sampleRate === undefined)
      throw new TypeError("Failed to construct 'OfflineAudioContext': required members are missing.")

    // Validate parameter ranges
    if (numberOfChannels < 1 || numberOfChannels > 32) throw _NotSupported('numberOfChannels must be between 1 and 32')
    if (!(length >= 1)) throw _NotSupported('length must be >= 1')
    if (sampleRate < 3000 || sampleRate > 768000) throw _NotSupported('sampleRate must be between 3000 and 768000')

    super(sampleRate, numberOfChannels)
    this.#numberOfChannels = numberOfChannels
    this.#length = length
  }

  startRendering() {
    if (this._state === 'closed') return Promise.reject(new Error('context is closed'))

    try {
      this._setState('running')

      let outBuf = new AudioBuffer(this.#numberOfChannels, this.#length, this.sampleRate)
      let written = 0

      while (written < this.#length) {
        let block = this._renderQuantum()
        let remaining = this.#length - written
        let count = Math.min(BLOCK_SIZE, remaining)

        for (let ch = 0; ch < this.#numberOfChannels; ch++) {
          let src = block.getChannelData(Math.min(ch, block.numberOfChannels - 1))
          let dst = outBuf.getChannelData(ch)
          for (let i = 0; i < count; i++) dst[written + i] = src[i]
        }

        written += count
      }

      this.#renderedBuffer = outBuf
      // currentTime advances in render quantum blocks, rounded up
      this._frame = Math.ceil(this.#length / BLOCK_SIZE) * BLOCK_SIZE
      this._setState('closed')
      let ev = new Event('complete')
      ev.renderedBuffer = outBuf
      this.dispatchEvent(ev)
      return Promise.resolve(outBuf)
    } catch (e) {
      this._setState('closed')
      return Promise.reject(e)
    }
  }

  suspend(suspendTime) {
    if (this._state === 'closed') return Promise.reject(new (globalThis.DOMException || Error)('context is closed', 'InvalidStateError'))
    if (suspendTime === undefined) return Promise.reject(new (globalThis.DOMException || Error)('suspendTime is required', 'InvalidStateError'))
    return Promise.resolve()
  }

  resume() {
    if (this._state === 'closed') return Promise.reject(new (globalThis.DOMException || Error)('context is closed', 'InvalidStateError'))
    return Promise.reject(new (globalThis.DOMException || Error)('cannot resume an OfflineAudioContext', 'InvalidStateError'))
  }

  get renderedBuffer() { return this.#renderedBuffer }
}

export default OfflineAudioContext
