var _ = require('underscore'),
  events = require('events'),
  async = require('async'),
  pcmUtils = require('pcm-boilerplate'),
  utils = require('./utils'),
  constants = require('./constants'),
  BLOCK_SIZE = constants.BLOCK_SIZE,
  AudioBuffer = require('./AudioBuffer'),
  AudioDestinationNode = require('./AudioDestinationNode'),
  AudioBufferSourceNode = require('./AudioBufferSourceNode'),
  GainNode = require('./GainNode'),
  ScriptProcessorNode = require('./ScriptProcessorNode'),
  Speaker;

try {
  Speaker = require('speaker')
} catch (err) {
  console.warn('Speaker is not available, fix this if you need sound playback.')
}

class AudioContext extends events.EventEmitter {

  constructor(opts) {

    Object.defineProperty(this, 'destination', {
      writable: false,
      value: new AudioDestinationNode(this)
    })

    this.currentTime = 0
    this.sampleRate = 44100

    // Tools for encoding the audio received to PCM data
    var format = {
      numberOfChannels: 2, // 2 channels
      bitDepth: 16, // 16-bit samples
      sampleRate: 44100 // 44,100 Hz sample rate
    };

    opts = opts || {};
    if (opts.bufferSize) format.bufferSize = opts.bufferSize;
    if (opts.numBuffers) format.numBuffers = opts.numBuffers;

    if (Speaker) this.outStream = new Speaker(format);
    else this.outStream = null;
    this._encoder = pcmUtils.BufferEncoder(format);
    this._frame = 0;
    this._playing = true;
    this._audioOutLoopRunning = false;

    // When a new connection is established, start to pull audio
    this.destination._inputs[0].on('connection', this._audioLoop.bind(this));
  }

  _audioLoop() {
    var outBuff;
    if (this._audioOutLoopRunning) return;
    if (!this.outStream) throw new Error('you need to set outStream to send the audio somewhere');
    this._audioOutLoopRunning = true;
    async.whilst(
      () => {
        return this._playing;
      }, (next) => {
        outBuff = this.destination._tick();
        // If there is space in the output stream's buffers, we write,
        // otherwise we wait for 'drain'
        this._frame += BLOCK_SIZE;
        this.currentTime = this._frame * 1 / this.sampleRate;
        if (this.outStream.write(this._encoder(outBuff._data))) next();
        else this.outStream.once('drain', next);
      }, (err) => {
        this._audioOutLoopRunning = false;
        if (err) return this.emit('error', err);
      }
    )
  }

  createBuffer(numberOfChannels, length, sampleRate) {
    return new AudioBuffer(numberOfChannels, length, sampleRate)
  }

  decodeAudioData(audioData, successCallback, errorCallback) {
    utils.decodeAudioData(audioData, function(err, audioBuffer) {
      if (err) errorCallback(err)
      else successCallback(audioBuffer)
    })
  }

  createBufferSource() {
    return new AudioBufferSourceNode(this)
  }

  createGain() {
    return new GainNode(this)
  }

  createScriptProcessor(bufferSize, numberOfInputChannels, numberOfOutputChannels) {
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

  _kill() {
    this._playing = false;
    if (this.outStream.close) {
      this.outStream.close();
    } else {
      this.outStream.end();
    }
  }

  collectNodes(node, allNodes) {
    allNodes = allNodes || []
    node = node || this.destination
    _.chain(node._inputs)
      .pluck('sources')
      .reduce(function(all, sources) {
        return all.concat(sources)
      }, [])
      .pluck('node').value()
      .forEach((upstreamNode) => {
        if (!_.contains(allNodes, upstreamNode)) {
          allNodes.push(upstreamNode)
          this.collectNodes(upstreamNode, allNodes)
        }
      })
    return allNodes
  }

}

module.exports = AudioContext
