var AudioNode = require('./AudioNode'),
  AudioParam = require('./AudioParam'),
  AudioBuffer = require('./AudioBuffer'),
  BLOCK_SIZE = require('./constants').BLOCK_SIZE,
  readOnlyAttr = require('./utils').readOnlyAttr;
require('es6-shim')

class DelayNode extends AudioNode {

  constructor(context, maxDelayTime) {
    super(context, 1, 1, undefined, 'max', 'speakers');
    readOnlyAttr(this, 'delayTime', new AudioParam(this.context, 0, 'a'));
    this.readPos = 0;
    // Ringbuffer creation
    this.maxDelayTime = this.maxDelayTime || 1.0
    this.ringbufferSize = this.maxDelayTime * this.context.sampleRate;
    if(!Number.isInteger(this.ringbufferSize)) this.ringbufferSize = parseInt(this.ringbufferSize) + 1;
    this.ringbuffer = RingAudioBuffer.filledWithVal(0, 2, this.ringbufferSize, this.context.sampleRate);
  }

  _tick() {
    var outBuff, inBuff, ringPos, delayArray, i, j, ch, inChArray, outChArray, ringbufferChArray;
    super._tick(arguments);
    inBuff = this._inputs[0]._tick();
    // Copy input buffer in the ringbuffer
    this.ringbuffer.append(inBuff);
    // Get the delay
    delayArray = this.delayTime._tick().getChannelData(0);
    // Init output buffer
    outBuff = new AudioBuffer(inBuff.numberOfChannels, BLOCK_SIZE, this.context.sampleRate);
    // Fill output buffer regarding the value of the delay
    for (j = 0; j < BLOCK_SIZE; j++) {
      var delay = parseInt(delayArray[j] * this.context.sampleRate, 10); // delay in samples
      for (ch = 0; ch < inBuff.numberOfChannels; ch++) {
        outChArray = outBuff.getChannelData(ch);
        ringbufferChArray = this.ringbuffer.getChannelData(ch);
        for (i = 0; i < BLOCK_SIZE; i++) {
          ringPos  = this.readPos + i - delay;
          if(ringPos < 0) ringPos += this.ringbufferSize;
          outChArray[i] = ringbufferChArray[ringPos];
        }
      }
    }
    this.readPos = ringPos;
    return outBuff;
  }

}


class RingAudioBuffer extends AudioBuffer {

  constructor(numberOfChannels, length, sampleRate) {
    super(numberOfChannels, length, sampleRate);
    this.writePos = 0;
  }

  append(buffer) {
    var ch, i, ringChArray, bufferChArray;
    for (ch = 0; ch < this.numberOfChannels; ch++) {
      ringChArray = this.getChannelData(ch);
      bufferChArray = buffer.getChannelData(ch);
      for (i = 0; i < BLOCK_SIZE; i++) {
        ringChArray[(i + this.writePos) % this.length] = bufferChArray[i];
      }
    }
    this.writePos = (this.writePos + BLOCK_SIZE) % this.length;
  }

}

module.exports = DelayNode;
