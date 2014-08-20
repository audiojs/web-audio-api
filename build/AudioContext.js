var _ = require('underscore'),
  events = require('events'),
  inherits = require('util').inherits,
  async = require('async'),
  pcmUtils = require('pcm-boilerplate'),
  utils = require('./utils'),
  constants = require('./constants'),
  BLOCK_SIZE = constants.BLOCK_SIZE,
  AudioBuffer = require('audiobuffer'),
  AudioDestinationNode = require('./AudioDestinationNode'),
  AudioBufferSourceNode = require('./AudioBufferSourceNode'),
  GainNode = require('./GainNode'),
  ScriptProcessorNode = require('./ScriptProcessorNode'),
  Speaker

try {
  Speaker = require('speaker')
} catch (err) {
  console.warn('Speaker is not available, fix this if you need sound playback.')
}

var AudioContext = (function(super$0){var DP$0 = Object.defineProperty;var MIXIN$0 = function(t,s){for(var p in s){if(s.hasOwnProperty(p)){DP$0(t,p,Object.getOwnPropertyDescriptor(s,p));}}return t};"use strict";MIXIN$0(AudioContext, super$0);

  function AudioContext(opts) {
    var self = this,
      outBuff

    /*Object.defineProperty(this, 'currentTime', {
    writable: false,
    get: function() {}
  })*/
/*
    Object.defineProperty(this, 'destination', {
      writable: false,
      value: new AudioDestinationNode(this)
    })*/
    this.destination = new AudioDestinationNode(this);

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
      numberOfChannels: 2, // 2 channels
      bitDepth: 16, // 16-bit samples
      sampleRate: 44100 // 44,100 Hz sample rate
    }

    opts = opts || {};
    if (opts.bufferSize) format.bufferSize = opts.bufferSize;
    if (opts.numBuffers) format.numBuffers = opts.numBuffers;

    if (Speaker) this.outStream = new Speaker(format)
    else this.outStream = null
    this._encoder = pcmUtils.BufferEncoder(format)
    this._frame = 0
    this._playing = true
    this._audioOutLoopRunning = false

    // When a new connection is established, start to pull audio
    this.destination._inputs[0].on('connection', function() {
      if (self._audioOutLoopRunning) return
      if (!self.outStream) throw new Error('you need to set outStream to send the audio somewhere')
      self._audioOutLoopRunning = true
      async.whilst(
        function() {
          return self._playing
        },
        function(next) {
          outBuff = self.destination._tick()
          // If there is space in the output stream's buffers, we write,
          // otherwise we wait for 'drain'
          self._frame += BLOCK_SIZE
          self.currentTime = self._frame * 1 / self.sampleRate
          if (self.outStream.write(self._encoder(outBuff._data))) next()
          else self.outStream.once('drain', next)
        },
        function(err) {
          self._audioOutLoopRunning = false
          if (err) return self.emit('error', err)
        }
      )
    })
  }AudioContext.prototype = Object.create(super$0.prototype, {"constructor": {"value": AudioContext, "configurable": true, "writable": true} });DP$0(AudioContext, "prototype", {"configurable": false, "enumerable": false, "writable": false});

  AudioContext.prototype.createBuffer = function(numberOfChannels, length, sampleRate) {
    return new AudioBuffer(numberOfChannels, length, sampleRate)
  }

  AudioContext.prototype.decodeAudioData = function(audioData, successCallback, errorCallback) {
    utils.decodeAudioData(audioData, function(err, audioBuffer) {
      if (err) errorCallback(err)
      else successCallback(audioBuffer)
    })
  }

  AudioContext.prototype.createBufferSource = function() {
    return new AudioBufferSourceNode(this)
  }

  AudioContext.prototype.createGain = function() {
    return new GainNode(this)
  }

  AudioContext.prototype.createScriptProcessor = function(bufferSize, numberOfInputChannels, numberOfOutputChannels) {
    return new ScriptProcessorNode(this, bufferSize, numberOfInputChannels, numberOfOutputChannels)
  }

  /*
{

    readonly attribute AudioDestinationNode destination;
    readonly attribute float sampleRate;
    readonly attribute double currentTime;
    readonly attribute AudioListener listener;

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

  AudioContext.prototype._kill = function() {
    var self = this
    this._playing = false
    if (self.outStream.close) self.outStream.close()
    else self.outStream.end()
  }

  AudioContext.prototype.collectNodes = function(node, allNodes) {
    var self = this
    allNodes = allNodes || []
    node = node || this.destination
    console.log(this.destination);
    console.log(">", node._inputs.length);
    _.chain(node._inputs)
      .pluck('sources')
      .reduce(function(all, sources) {
        return all.concat(sources)
      }, [])
      .pluck('node').value()
      .forEach(function(upstreamNode) {
        if (!_.contains(allNodes, upstreamNode)) {
          allNodes.push(upstreamNode)
          self.collectNodes(upstreamNode, allNodes)
        }
      })
    return allNodes
  }

;return AudioContext;})(events.EventEmitter);

module.exports = AudioContext
