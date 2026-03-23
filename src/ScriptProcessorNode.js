import { BLOCK_SIZE } from './constants.js'
import AudioNode from './AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { from, concat, slice } from 'audio-buffer/util'


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

  // NOTE: This setter replaces _tick() at runtime — the only place in the codebase
  // where the rendering method is dynamically swapped. This is intentional: SPN needs
  // to buffer input across multiple quanta before firing onaudioprocess, which requires
  // closure state. SPN is deprecated (W3C spec), so this pattern won't spread.
  set onaudioprocess(onaudioprocess) {
    let inputBuffer = null
    let outputBuffer = null
    // Spec: SPN latency is 2*bufferSize. Track frames to enforce this.
    let frameCount = 0
    let latency = 2 * this.#bufferSize

    this._tick = function() {
      AudioNode.prototype._tick.call(this)

      let inBlock = this._inputs[0]._tick()
      // Clone the input block since AudioInput reuses its internal mix buffer
      let cloned = from(inBlock)
      inputBuffer = inputBuffer ? concat(inputBuffer, cloned) : cloned

      if (inputBuffer.length === this.bufferSize) {
        let event = this._processingEvent(inputBuffer)
        onaudioprocess(event)
        inputBuffer = null
        outputBuffer = outputBuffer ? concat(outputBuffer, event.outputBuffer) : event.outputBuffer
      } else if (inputBuffer.length >= this.bufferSize) throw new Error('this shouldnt happen')

      frameCount += BLOCK_SIZE

      // Enforce 2*bufferSize latency: don't emit output until enough frames have passed
      if (frameCount > latency && outputBuffer && outputBuffer.length >= BLOCK_SIZE) {
        let returned = slice(outputBuffer, 0, BLOCK_SIZE)
        outputBuffer = outputBuffer.length > BLOCK_SIZE ? slice(outputBuffer, BLOCK_SIZE) : null
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
