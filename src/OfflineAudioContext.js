import BaseAudioContext from './BaseAudioContext.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'


class OfflineAudioContext extends BaseAudioContext {
  #length
  #numberOfChannels
  #renderedBuffer = null

  get length() { return this.#length }

  constructor(numberOfChannels, length, sampleRate) {
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
      this._frame = this.#length
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

  suspend() {
    // spec allows suspend(time) on OfflineAudioContext but we don't support mid-render pause yet
    return Promise.resolve()
  }

  resume() {
    return Promise.resolve()
  }

  get renderedBuffer() { return this.#renderedBuffer }
}

export default OfflineAudioContext
