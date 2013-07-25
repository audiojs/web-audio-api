var _ = require('underscore')
  , EventEmitter = require('events').EventEmitter
  , inherits = require('util').inherits
  , async = require('async')
  , pcmUtils = require('pcm-boilerplate')
  , Speaker = require('speaker')
  , constants = require('./constants')
  , BLOCK_SIZE = constants.BLOCK_SIZE
  , AudioBuffer = require('audiobuffer')
  , AudioDestinationNode = require('./AudioDestinationNode')

var AudioContext = module.exports = function() {
  var self = this
    , outBuff

  /*Object.defineProperty(this, 'currentTime', {
    writable: false,
    get: function() {}
  })*/

  Object.defineProperty(this, 'destination', {
    writable: false,
    value: new AudioDestinationNode(this)
  })

  /*Object.defineProperty(this, 'sampleRate', {
    writable: false,
    value: {} // TODO
  })

  Object.defineProperty(this, 'listener', {
    writable: false,
    value: {} // TODO
  })*/
  this.currentTime = 0
  this.sampleRate = 44100

  // Tools for encoding the audio received to PCM data
  var format = {
    numberOfChannels: 2,  // 2 channels
    bitDepth: 16,         // 16-bit samples
    sampleRate: 44100     // 44,100 Hz sample rate
  }
  this._speaker = new Speaker(format)
  this._encoder = pcmUtils.BufferEncoder(format)
  this._frame = 0
  this._playing = true

  // When a new connection is established, start to pull audio
  this.destination._inputs[0].on('connection', function() {
    async.whilst(
      function() { return self._playing },
      function(next) {
        outBuff = self.destination._tick()
        // If there is space in `Speaker`s buffers, we write,
        // otherwise we wait for 'drain'
        self._frame += BLOCK_SIZE
        self.currentTime = self._frame * 1/self.sampleRate
        if (self._speaker.write(self._encoder(outBuff._data))) next()
        else self._speaker.once('drain', next)
      },
      function(err) {
        if (err) return self.emit('error', err)
      }
    )
  })
}

inherits(AudioContext, EventEmitter)


_.extend(AudioContext.prototype, {

  createBuffer: function(numberOfChannels, length, sampleRate) {
    return AudioBuffer.zeros(numberOfChannels, length, sampleRate)
  },

  _kill: function() {
    var self = this
    this._playing = false
    self._speaker.close()      
  }
  /*
{

    readonly attribute AudioDestinationNode destination;
    readonly attribute float sampleRate;
    readonly attribute double currentTime;
    readonly attribute AudioListener listener;

    void decodeAudioData(ArrayBuffer audioData,
                         DecodeSuccessCallback successCallback,
                         optional DecodeErrorCallback errorCallback);


    // AudioNode creation 
    AudioBufferSourceNode createBufferSource();

    MediaElementAudioSourceNode createMediaElementSource(HTMLMediaElement mediaElement);

    MediaStreamAudioSourceNode createMediaStreamSource(MediaStream mediaStream);
    MediaStreamAudioDestinationNode createMediaStreamDestination();

    ScriptProcessorNode createScriptProcessor(optional unsigned long bufferSize = 0,
                                              optional unsigned long numberOfInputChannels = 2,
                                              optional unsigned long numberOfOutputChannels = 2);

    AnalyserNode createAnalyser();
    GainNode createGain();
    DelayNode createDelay(optional double maxDelayTime = 1.0);
    BiquadFilterNode createBiquadFilter();
    WaveShaperNode createWaveShaper();
    PannerNode createPanner();
    ConvolverNode createConvolver();

    ChannelSplitterNode createChannelSplitter(optional unsigned long numberOfOutputs = 6);
    ChannelMergerNode createChannelMerger(optional unsigned long numberOfInputs = 6);

    DynamicsCompressorNode createDynamicsCompressor();

    OscillatorNode createOscillator();
    PeriodicWave createPeriodicWave(Float32Array real, Float32Array imag);

}
  */

})


