import _ from 'underscore'
import events from 'events'
import async from 'async'
import pcmUtils from 'pcm-boilerplate'
import * as utils from './utils.js'
import * as constants from './constants.js'
import AudioBuffer from './AudioBuffer.js'
import AudioListener from './AudioListener.js'
import AudioDestinationNode from './AudioDestinationNode.js'
import AudioBufferSourceNode from './AudioBufferSourceNode.js'
import GainNode from './GainNode.js'
import ScriptProcessorNode from './ScriptProcessorNode.js'
import PannerNode from './PannerNode/index.js'

const {BLOCK_SIZE} = constants

class AudioContext extends events.EventEmitter {

  constructor(opts) {
    super();

    var outBuff

    /*Object.defineProperty(this, 'currentTime', {
    writable: false,
    get: function() {}
  })*/

    Object.defineProperty(this, 'destination', {
      writable: false,
      value: new AudioDestinationNode(this)
    })
    //this.destination = new AudioDestinationNode(this)

    // TODO
    // Object.defineProperty(this, 'sampleRate', {
    //   writable: false,
    //   value: {}
    // })

    Object.defineProperty(this, 'listener', {
      writable : false,
      value    : new AudioListener(),
    })

    this.currentTime = 0
    this.sampleRate = 44100
    this.numberOfChannels = 2
    this.bitDepth = 16

    this.format = {
      numberOfChannels: 2,
      bitDepth: 16,
      sampleRate: this.sampleRate
    }

    opts = opts || {}
    if (opts.bufferSize) this.format.bufferSize = opts.bufferSize
    if (opts.numBuffers) this.format.numBuffers = opts.numBuffers

    this.outStream = null
    this._encoder = pcmUtils.BufferEncoder(this.format)
    this._frame = 0
    this._playing = true
    this._audioOutLoopRunning = false

    // When a new connection is established, start to pull audio
    this.destination._inputs[0].on('connection', () => {
      if (this._audioOutLoopRunning) return
      if (!this.outStream) throw new Error('you need to set outStream to send the audio somewhere')
      this._audioOutLoopRunning = true
      async.whilst(
        () => {
          return this._playing
        },
        (next) => {
          outBuff = this.destination._tick()
          // If there is space in the output stream's buffers, we write,
          // otherwise we wait for 'drain'
          this._frame += BLOCK_SIZE
          this.currentTime = this._frame * 1 / this.sampleRate
          // TODO setImmediate here is for cases where the outStream won't get
          // full and we end up with call stack max size reached.
          // But is it optimal?
          if (this.outStream.write(this._encoder(outBuff._data)))
            setImmediate(next)
          else this.outStream.once('drain', next)
        },
        (err) => {
          this._audioOutLoopRunning = false
          if (err) return this.emit('error', err)
        }
      )
    })
  }

  createBuffer(numberOfChannels, length, sampleRate) {
    return new AudioBuffer(numberOfChannels, length, sampleRate)
  }

  decodeAudioData(audioData, successCallback, errorCallback) {
    // Pseudo overload
    if (arguments.length > 1) {
      // Callback
      utils.decodeAudioData(audioData, function(err, audioBuffer) {
        if (err) errorCallback(err)
        else successCallback(audioBuffer)
      })
    } else {
      // Promise
      return utils.decodeAudioData(audioData)
    }
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

  createPanner() {
    return new PannerNode(this)
  }

  /*
{

    readonly attribute AudioDestinationNode destination
    readonly attribute float sampleRate
    readonly attribute double currentTime
    readonly attribute AudioListener listener

    // AudioNode creation
    MediaElementAudioSourceNode createMediaElementSource(HTMLMediaElement mediaElement)

    MediaStreamAudioSourceNode createMediaStreamSource(MediaStream mediaStream)
    MediaStreamAudioDestinationNode createMediaStreamDestination()

    AnalyserNode createAnalyser()
    DelayNode createDelay(optional double maxDelayTime = 1.0)
    BiquadFilterNode createBiquadFilter()
    WaveShaperNode createWaveShaper()
    PannerNode createPanner()
    ConvolverNode createConvolver()

    ChannelSplitterNode createChannelSplitter(optional unsigned long numberOfOutputs = 6)
    ChannelMergerNode createChannelMerger(optional unsigned long numberOfInputs = 6)

    DynamicsCompressorNode createDynamicsCompressor()

    OscillatorNode createOscillator()
    PeriodicWave createPeriodicWave(Float32Array real, Float32Array imag)

}
  */

  _kill() {
    this._playing = false
    if (this.outStream) {
      if (this.outStream.close) {
        this.outStream.close()
      } else {
        this.outStream.end()
      }
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

export default AudioContext
