var _ = require('underscore')
  , EventEmitter = require('events').EventEmitter
  , inherits = require('util').inherits
  , async = require('async')
  , pcmUtils = require('pcm-boilerplate')
  , constants = require('./constants')
  , BLOCK_SIZE = constants.BLOCK_SIZE
  , AudioBuffer = require('audiobuffer')
  , AudioDestinationNode = require('./AudioDestinationNode')
  , AudioBufferSourceNode = require('./AudioBufferSourceNode')
  , GainNode = require('./GainNode')
  , ScriptProcessorNode = require('./ScriptProcessorNode')
  , Speaker

try {
  Speaker = require('speaker')
} catch(err) {
  console.warn('Speaker is not available, fix this if you need sound playback.')
}

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

  if (Speaker) this.outStream = new Speaker(format)
  else this.outStream = null
  this._encoder = pcmUtils.BufferEncoder(format)
  this._frame = 0
  this._playing = true

  // When a new connection is established, start to pull audio
  this.destination._inputs[0].on('connection', function() {
    if (!self.outStream) throw new Error('you need to set outStream to send the audio somewhere')
    async.whilst(
      function() { return self._playing },
      function(next) {
        outBuff = self.destination._tick()
        // If there is space in the output stream's buffers, we write,
        // otherwise we wait for 'drain'
        self._frame += BLOCK_SIZE
        self.currentTime = self._frame * 1/self.sampleRate
        if (self.outStream.write(self._encoder(outBuff._data))) next()
        else self.outStream.once('drain', next)
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
    self.outStream.close()      
  },

  createBufferSource: function() {
    return new AudioBufferSourceNode(this)
  },

  createGain: function() {
    return new GainNode(this)
  },

  createScriptProcessor(bufferSize, numberOfInputChannels, numberOfOutputChannels) {
    return new ScriptProcessorNode(this, bufferSize, numberOfInputChannels, numberOfOutputChannels)
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
    MediaElementAudioSourceNode createMediaElementSource(HTMLMediaElement mediaElement);

    MediaStreamAudioSourceNode createMediaStreamSource(MediaStream mediaStream);
    MediaStreamAudioDestinationNode createMediaStreamDestination();

    AnalyserNode createAnalyser();
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

  collectNodes: function(node, allNodes) {
    var self = this
    allNodes = allNodes || []
    node = node || this.destination
    _.chain(node._inputs)
      .pluck('sources')
      .reduce(function(all, sources) { return all.concat(sources) }, [])
      .pluck('node').value()
      .forEach(function(upstreamNode) {
        if (!_.contains(allNodes, upstreamNode)) {
          allNodes.push(upstreamNode)
          self.collectNodes(upstreamNode, allNodes)
        }
      })
    return allNodes
  }

})


