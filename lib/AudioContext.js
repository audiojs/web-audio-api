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
    value: {} // TODO
  })

  Object.defineProperty(this, 'sampleRate', {
    writable: false,
    value: {} // TODO
  })

  Object.defineProperty(this, 'listener', {
    writable: false,
    value: {} // TODO
  })

  this.destination = new AudioContextDestinationNode(this)
  this.destination._inputs[0].on('connection', function() {
    async.whilst(
      function() { return true },
      function(next) {
        self.input.read(self.opts.blockSize, function(err, block) {
          if (err) next(err)
          else {
            if (self._speaker.write(self._encoder(block))) next()
            else self._speaker.once('drain', next)
          }
        })
      },
      function(err) {
        self.emit('error', err)
      }
    )
  })
  this._nodes = [this.destination]
}


_.extend(AudioContext.prototype, {

  createBuffer: (numberOfChannels, length, sampleRate) {
    return AudioBuffer.zeros(numberOfChannels, length, sampleRate)
  },

  tick: function(buffer) { return buffer }
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


var AudioContextDestinationNode = function() {
  AudioDestinationNode.apply(this, arguments)
  var self = this
  this.opts = _.defaults(opts || {}, {
    // Size of blocks read from the input
    blockSize: 1024
  })
  var format = {
    channels: 2,          // 2 channels
    bitDepth: 16,         // 16-bit samples
    sampleRate: 44100     // 44,100 Hz sample rate
  }
  this._speaker = new Speaker(format)
  this._encoder = utils.PCMEncoder(format)

}
inherits(AudioContextDestinationNode, AudioDestinationNode)


