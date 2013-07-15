var _ = require('underscore')
  , inherits = require('util').inherits
  , async = require('async')
  , utils = require('./utils')
  , Speaker = require('speaker')
  , AudioBuffer = require('./AudioBuffer')
  , AudioDestinationNode = require('./AudioDestinationNode')

var AudioContext = function() {
  var self = this

  Object.defineProperty(this, 'currentTime', {
    writable: false,
    get: function() {}
  })

  Object.defineProperty(this, 'destination', {
    writable: false,
    value: new AudioDestinationNode(this)
  })

  Object.defineProperty(this, 'sampleRate', {
    writable: false,
    value: {} // TODO
  })

  Object.defineProperty(this, 'listener', {
    writable: false,
    value: {} // TODO
  })

  // Tools for encoding the audio received to PCM data
  var format = {
    channels: 2,          // 2 channels
    bitDepth: 16,         // 16-bit samples
    sampleRate: 44100     // 44,100 Hz sample rate
  }
  this._speaker = new Speaker(format)
  this._encoder = utils.PCMEncoder(format)

  // When a new connection is established, start to pull audio
  this.destination._inputs[0].on('connection', function() {
    async.whilst(
      function() { return true },
      function(next) {
        self.destination.pullAudio(function(err, outBuff) {
          if (err) return next(err)
          // If there is space in `Speaker`s buffers, we write,
          // otherwise we wait for 'drain'
          if (self._speaker.write(self._encoder(outBuff))) next()
          else self._speaker.once('drain', next)
        })
      },
      function(err) { self.emit('error', err) }
    )
  })
}


_.extend(AudioContext.prototype, {

  createBuffer: (numberOfChannels, length, sampleRate) {
    return AudioBuffer.zeros(numberOfChannels, length, sampleRate)
  },
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


