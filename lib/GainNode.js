var  _ = require('underscore')
  , inherits = require('util').inherits
  , AudioNode = require('./AudioNode')
  , AudioParam = require('./AudioParam')
  , AudioBuffer = require('audiobuffer')
  , BLOCK_SIZE = require('./constants').BLOCK_SIZE
  , readOnlyAttr = require('./utils').readOnlyAttr

var GainNode = module.exports = function(context) {
  AudioNode.call(this, context, 1, 1)
  this.channelCountMode = 'max'
  this.channelInterpretation = 'speakers'
  readOnlyAttr(this, 'gain', new AudioParam(this.context, 1, 'a'))
}
inherits(GainNode, AudioNode)

_.extend(GainNode.prototype, {

  _tick: function() {
    var outBuff, inBuff, gainArray
      , i, ch, inChArray, outChArray
    AudioNode.prototype._tick.apply(this, arguments)
    inBuff = this._inputs[0]._tick()
    gainArray = this.gain._tick().getChannelData(0)
    outBuff = new AudioBuffer(inBuff.numberOfChannels, BLOCK_SIZE, this.context.sampleRate)
    for (ch = 0; ch < inBuff.numberOfChannels; ch++) {
      inChArray = inBuff.getChannelData(ch)
      outChArray = outBuff.getChannelData(ch)
      for (i = 0; i < BLOCK_SIZE; i++)
        outChArray[i] = inChArray[i] * gainArray[i]
    }
    return outBuff
  }

})