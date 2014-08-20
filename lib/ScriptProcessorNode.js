var inherits = require('util').inherits,
  _ = require('underscore'),
  math = require('mathjs'),
  BLOCK_SIZE = require('./constants').BLOCK_SIZE,
  AudioNode = require('./AudioNode'),
  AudioBuffer = require('audiobuffer'),
  readOnlyAttr = require('./utils').readOnlyAttr

class ScriptProcessorNode extends AudioNode {
  constructor(context, bufferSize, numberOfInputChannels, numberOfOutputChannels) {
    if (!_.contains([256, 512, 1024, 2048, 4096, 8192, 16384], bufferSize))
      throw new Error('invalid bufferSize')

    super(context, 1, 1)
    this.channelCountMode = 'explicit'
    this.channelInterpretation = 'speakers'
    readOnlyAttr(this, 'channelCount', numberOfInputChannels)
    readOnlyAttr(this, 'bufferSize', bufferSize)

    this._processingEvent = function(inBuffer) {
      return new AudioProcessingEvent(
        this.context.currentTime,
        inBuffer,
        new AudioBuffer(numberOfOutputChannels, bufferSize, context.sampleRate)
      )
    }

    this._tick = function() {
      AudioNode.prototype._tick.apply(this, arguments)
      return new AudioBuffer(numberOfOutputChannels, BLOCK_SIZE, context.sampleRate)
    }

    Object.defineProperty(this, 'onaudioprocess', {

      set: function(onaudioprocess) {
        var inputBuffer = new AudioBuffer(numberOfInputChannels, 0, context.sampleRate),
          outputBuffer = new AudioBuffer(numberOfOutputChannels, 0, context.sampleRate)

        this._tick = function() {
          AudioNode.prototype._tick.apply(this, arguments)

          // Pull some data and add it to `inputBuffer`
          inputBuffer = inputBuffer.concat(this._inputs[0]._tick())

          // When enough data in `inputBuffer`, we run `onaudioprocess`
          if (inputBuffer.length === bufferSize) {
            var audioProcEvent = this._processingEvent(inputBuffer)
            onaudioprocess(audioProcEvent)
            inputBuffer = new AudioBuffer(numberOfInputChannels, 0, context.sampleRate)
            outputBuffer = outputBuffer.concat(audioProcEvent.outputBuffer)
          } else if (inputBuffer.length >= bufferSize) throw new Error('this shouldnt happen')

          // When data has been processed, we return it
          if (outputBuffer.length >= BLOCK_SIZE) {
            var returnedBuffer = outputBuffer.slice(0, BLOCK_SIZE)
            outputBuffer = outputBuffer.slice(BLOCK_SIZE)
            return returnedBuffer
          } else return new AudioBuffer(numberOfOutputChannels, BLOCK_SIZE, context.sampleRate)
        }

      }

    })
  }

  onaudioprocess() {}

}



var AudioProcessingEvent = function(playbackTime, inputBuffer, outputBuffer) {
  this.playbackTime = playbackTime
  this.inputBuffer = inputBuffer
  this.outputBuffer = outputBuffer
}

module.exports = ScriptProcessorNode
