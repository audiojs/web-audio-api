import BaseAudioContext from './BaseAudioContext.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'


class OfflineAudioContext extends BaseAudioContext {
  #length
  #numberOfChannels
  #renderedBuffer = null

  get length() { return this.#length }

  constructor(numberOfChannels, length, sampleRate) {
    super(sampleRate)
    this.#numberOfChannels = numberOfChannels
    this.#length = length
  }

  startRendering() {
    if (this._state === 'closed') return Promise.reject(new Error('context is closed'))

    return new Promise((resolve, reject) => {
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
        this._setState('closed')
        this.dispatchEvent(new CustomEvent('complete', { detail: { renderedBuffer: outBuf } }))
        resolve(outBuf)
      } catch (e) {
        this._setState('closed')
        reject(e)
      }
    })
  }

  suspend() {
    return Promise.reject(new Error('suspend() not supported on OfflineAudioContext'))
  }

  resume() {
    return Promise.reject(new Error('resume() not supported on OfflineAudioContext'))
  }

  get renderedBuffer() { return this.#renderedBuffer }
}

export default OfflineAudioContext
