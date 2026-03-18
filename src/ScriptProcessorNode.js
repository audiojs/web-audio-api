import { BLOCK_SIZE } from './constants.js'
import AudioNode from './AudioNode.js'
import AudioBuffer from 'audio-buffer'


class ScriptProcessorNode extends AudioNode {

  #bufferSize
  get bufferSize() { return this.#bufferSize }

  constructor(context, bufferSize, numberOfInputChannels, numberOfOutputChannels) {
    // Per spec: bufferSize of 0 means implementation picks the best size
    if (bufferSize === 0) bufferSize = 4096
    if (![256, 512, 1024, 2048, 4096, 8192, 16384].includes(bufferSize)) throw new Error('invalid bufferSize')
    super(context, 1, 1, numberOfInputChannels, 'explicit', 'speakers')

    this.numberOfOutputChannels = numberOfOutputChannels
    this.#bufferSize = bufferSize
  }

  set onaudioprocess(onaudioprocess) {
    let inputBuffer = null
    let outputBuffer = null

    this._tick = function() {
      AudioNode.prototype._tick.call(this)

      let inBlock = this._inputs[0]._tick()
      inputBuffer = inputBuffer ? inputBuffer.concat(inBlock) : inBlock

      if (inputBuffer.length === this.bufferSize) {
        let event = this._processingEvent(inputBuffer)
        onaudioprocess(event)
        inputBuffer = null
        outputBuffer = outputBuffer ? outputBuffer.concat(event.outputBuffer) : event.outputBuffer
      } else if (inputBuffer.length >= this.bufferSize) throw new Error('this shouldnt happen')

      if (outputBuffer && outputBuffer.length >= BLOCK_SIZE) {
        let returned = outputBuffer.slice(0, BLOCK_SIZE)
        outputBuffer = outputBuffer.length > BLOCK_SIZE ? outputBuffer.slice(BLOCK_SIZE) : null
        return returned
      }
      return new AudioBuffer(this.numberOfOutputChannels, BLOCK_SIZE, this.context.sampleRate)
    }
  }

  _processingEvent(inBuffer) {
    return new AudioProcessingEvent(
      this.context.currentTime,
      inBuffer,
      new AudioBuffer(this.numberOfOutputChannels, this.bufferSize, this.context.sampleRate)
    )
  }

  _tick() {
    super._tick()
    return new AudioBuffer(this.numberOfOutputChannels, BLOCK_SIZE, this.context.sampleRate)
  }

}


class AudioProcessingEvent {

  constructor(playbackTime, inputBuffer, outputBuffer) {
    this.playbackTime = playbackTime
    this.inputBuffer = inputBuffer
    this.outputBuffer = outputBuffer
  }

}

export default ScriptProcessorNode
