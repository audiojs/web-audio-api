var AudioContext = require('./AudioContext'),
  AudioBuffer = require('./AudioBuffer'),
  constants = require('./constants'),
  async = require('async'),
  BLOCK_SIZE = constants.BLOCK_SIZE,
  Promise = require("native-promise-only");


class OfflineAudioContext extends AudioContext {

  constructor(numberOfChannels, length, sampleRate) {
    super();
    this.renderingStartedFlag = false;
    this.numberOfChannels = numberOfChannels;
    this.length = length; // I guess length of the PCM audio data in sample-frames.
    this.sampleRate = sampleRate;

    this.destination._inputs[0].removeAllListeners('connection');
  }

  startRendering() {
    return this._checkRenderingStartedFlag().then(
      this._render.bind(this),
      function(error) {
        throw error;
      });
  }

  _checkRenderingStartedFlag() {
    return new Promise((resolve, reject) => {
      if (this.renderingStartedFlag) {
        reject(new Error("INVALID_STATE_ERR")); // Should be DOMException, but can't find a way to instanciate it
      } else {
        this.renderingStartedFlag = true;
        resolve();
      }
    });
  }

  _render() {
    return new Promise((resolve, reject) => {
      var buffer = new AudioBuffer(this.numberOfChannels, 0, this.sampleRate);
      async.whilst(
        () => {
          return this._frame < this.length;
        }, (next) => {
          this._frame += BLOCK_SIZE;
          this.currentTime = this._frame * 1 / this.sampleRate;
          buffer = buffer.concat(this.destination._tick());
          next();
        }, (err) => {
          this.renderingStartedFlag = false;
          if (err) {
            reject(err);
            this.emit('error', err);
          } else {
            resolve(buffer);
            this.emit('complete', new OfflineAudioCompletionEvent(buffer));
          }
        }
      )
    })
  }

}


class OfflineAudioCompletionEvent {
  constructor(buffer) {
    this.renderedBuffer = new AudioBuffer();
  }
}

module.exports = OfflineAudioContext;
