var AudioNode = require('./AudioNode')
  , AudioParam = require('./AudioParam')
  , AudioBuffer = require('./AudioBuffer')
  , BLOCK_SIZE = require('./constants').BLOCK_SIZE
  , readOnlyAttr = require('./utils').readOnlyAttr

class GainNode extends AudioNode {

  constructor(context) {
    super(context, 1, 1, undefined, 'max', 'speakers')
    readOnlyAttr(this, 'gain', new AudioParam(this.context, 1, 'a'))
  }

  _tick() {
    var outBuff, inBuff, gainArray, i, ch, inChArray, outChArray
    super._tick(arguments)
    inBuff = this._inputs[0]._tick()
    gainArray = this.gain._tick().getChannelData(0)
    outBuff = new AudioBuffer(inBuff.numberOfChannels, BLOCK_SIZE, this.context.sampleRate)
    for (ch = 0; ch < inBuff.numberOfChannels; ch++) {
      inChArray = inBuff.getChannelData(ch)
      outChArray = outBuff.getChannelData(ch)
      for (i = 0; i < BLOCK_SIZE; i++) {
        outChArray[i] = inChArray[i] * gainArray[i]
      }
    }
    return outBuff
  }

}

module.exports = GainNode
