var _ = require('underscore')
  , BLOCK_SIZE = require('./constants').BLOCK_SIZE
  , AudioNode = require('./AudioNode')
  , AudioBuffer = require('./AudioBuffer')
  , readOnlyAttr = require('./utils').readOnlyAttr


class ScriptProcessorNode extends AudioNode {

  constructor(context, bufferSize, numberOfInputChannels, numberOfOutputChannels) {
    if (!_.contains([256, 512, 1024, 2048, 4096, 8192, 16384], bufferSize))
      throw new Error('invalid bufferSize')
    super(context, 1, 1, numberOfInputChannels, 'explicit', 'speakers')

    this.numberOfOutputChannels = numberOfOutputChannels
    readOnlyAttr(this, 'bufferSize', bufferSize)
  }

  set onaudioprocess(onaudioprocess) {

    var inputBuffer = new AudioBuffer(this.channelCount, 0, this.context.sampleRate)
      , outputBuffer = new AudioBuffer(this.numberOfOutputChannels, 0, this.context.sampleRate)

    this._tick = function() {
      AudioNode.prototype._tick.apply(this, arguments)

      // Pull some data and add it to `inputBuffer`
      inputBuffer = inputBuffer.concat(this._inputs[0]._tick())

      // When enough data in `inputBuffer`, we run `onaudioprocess`
      if (inputBuffer.length === this.bufferSize) {
        var audioProcEvent = this._processingEvent(inputBuffer)
        onaudioprocess(audioProcEvent)
        inputBuffer = new AudioBuffer(this.channelCount, 0, this.context.sampleRate)
        outputBuffer = outputBuffer.concat(audioProcEvent.outputBuffer)
      } else if (inputBuffer.length >= this.bufferSize) throw new Error('this shouldnt happen')

      // When data has been processed, we return it
      if (outputBuffer.length >= BLOCK_SIZE) {
        var returnedBuffer = outputBuffer.slice(0, BLOCK_SIZE)
        outputBuffer = outputBuffer.slice(BLOCK_SIZE)
        return returnedBuffer
      } else return new AudioBuffer(this.numberOfOutputChannels, BLOCK_SIZE, this.context.sampleRate)
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
    super._tick(arguments)
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

module.exports = ScriptProcessorNode
