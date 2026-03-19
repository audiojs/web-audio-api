import { decodeAudioData } from './utils.js'
import { BLOCK_SIZE } from './constants.js'
import { DOMErr } from './errors.js'
import AudioBuffer from 'audio-buffer'
import AudioListener from './AudioListener.js'
import AudioDestinationNode from './AudioDestinationNode.js'
import AudioBufferSourceNode from './AudioBufferSourceNode.js'
import ConstantSourceNode from './ConstantSourceNode.js'
import OscillatorNode from './OscillatorNode.js'
import PeriodicWave from './PeriodicWave.js'
import GainNode from './GainNode.js'
import StereoPannerNode from './StereoPannerNode.js'
import DelayNode from './DelayNode.js'
import BiquadFilterNode from './BiquadFilterNode.js'
import WaveShaperNode from './WaveShaperNode.js'
import IIRFilterNode from './IIRFilterNode.js'
import ConvolverNode from './ConvolverNode.js'
import DynamicsCompressorNode from './DynamicsCompressorNode.js'
import ChannelSplitterNode from './ChannelSplitterNode.js'
import ChannelMergerNode from './ChannelMergerNode.js'
import AnalyserNode from './AnalyserNode.js'
import ScriptProcessorNode from './ScriptProcessorNode.js'
import PannerNode from './PannerNode/index.js'
import { AudioWorklet } from './AudioWorklet.js'
import { MediaStreamAudioSourceNode, MediaStreamAudioDestinationNode, MediaElementAudioSourceNode } from './MediaStreamAudioSourceNode.js'


class BaseAudioContext extends EventTarget {
  _state = 'suspended'
  _frame = 0
  _sampleRate
  _destination
  _listener
  _tailNodes = new Set()  // nodes that need processing even when not connected to destination
  #onstatechange = null
  #oncomplete = null

  constructor(sampleRate = 44100, numberOfChannels = 2) {
    super()
    this._sampleRate = sampleRate
    this._destination = new AudioDestinationNode(this, numberOfChannels)
    this._listener = new AudioListener(this)
    this.audioWorklet = new AudioWorklet(this)
    // Cycle detection state: consolidated from ad-hoc properties
    this._cycle = { delayCount: 0, withoutDelay: false, detected: false, deferred: null }
  }

  get destination() { return this._destination }
  get listener() { return this._listener }
  get sampleRate() { return this._sampleRate }
  get currentTime() { return this._frame / this._sampleRate }
  get state() { return this._state }

  get onstatechange() { return this.#onstatechange }
  set onstatechange(fn) {
    if (this.#onstatechange) this.removeEventListener('statechange', this.#onstatechange)
    this.#onstatechange = fn
    if (fn) this.addEventListener('statechange', fn)
  }

  get oncomplete() { return this.#oncomplete }
  set oncomplete(fn) {
    if (this.#oncomplete) this.removeEventListener('complete', this.#oncomplete)
    this.#oncomplete = fn
    if (fn) this.addEventListener('complete', fn)
  }

  _setState(state) {
    if (this._state === state) return
    this._state = state
    this.dispatchEvent(new Event('statechange'))
  }

  // Render one quantum: pull graph + tail nodes, advance frame counter
  _renderQuantum() {
    let buf = this._destination._tick()
    // Process tail nodes (e.g. AnalyserNode, MediaStreamAudioDestinationNode) not in the destination graph
    for (let node of this._tailNodes)
      node._outputs.length ? node._outputs[0]._tick() : node._tick()
    // Process delay nodes that deferred their ring buffer update during a cycle.
    // At this point all upstream nodes have cached outputs, so re-pulling gives correct input.
    if (this._cycle.deferred) {
      let delays = this._cycle.deferred
      this._cycle.deferred = null
      for (let delay of delays) delay._deferredWrite()
    }
    this._frame += BLOCK_SIZE
    return buf
  }

  createBuffer(numberOfChannels, length, sampleRate) {
    return new AudioBuffer(numberOfChannels, length, sampleRate)
  }

  decodeAudioData(audioData, successCallback, errorCallback) {
    if (this._discarded) {
      let err = DOMErr('Document is not fully active', 'InvalidStateError')
      if (errorCallback) errorCallback(err)
      return Promise.reject(err)
    }
    let promise = decodeAudioData(audioData)
    if (successCallback) promise.then(successCallback, errorCallback)
    return promise
  }

  createBufferSource() { return new AudioBufferSourceNode(this) }
  createConstantSource() { return new ConstantSourceNode(this) }
  createOscillator() { return new OscillatorNode(this) }
  createPeriodicWave(real, imag, constraints) { return new PeriodicWave(real, imag, constraints) }
  createGain() { return new GainNode(this) }
  createStereoPanner() { return new StereoPannerNode(this) }
  createDelay(maxDelayTime) { return new DelayNode(this, { maxDelayTime }) }
  createBiquadFilter() { return new BiquadFilterNode(this) }
  createWaveShaper() { return new WaveShaperNode(this) }
  createIIRFilter(feedforward, feedback) { return new IIRFilterNode(this, { feedforward, feedback }) }
  createConvolver() { return new ConvolverNode(this) }
  createDynamicsCompressor() { return new DynamicsCompressorNode(this) }
  createChannelSplitter(numberOfOutputs) { return new ChannelSplitterNode(this, { numberOfOutputs }) }
  createChannelMerger(numberOfInputs) { return new ChannelMergerNode(this, { numberOfInputs }) }
  createAnalyser() { return new AnalyserNode(this) }
  createScriptProcessor(bufferSize, inCh, outCh) { return new ScriptProcessorNode(this, bufferSize, inCh, outCh) }
  createPanner() { return new PannerNode(this) }
  createMediaStreamSource(mediaStream) { return new MediaStreamAudioSourceNode(this, { mediaStream }) }
  createMediaStreamDestination() { return new MediaStreamAudioDestinationNode(this) }
  createMediaElementSource(mediaElement) { return new MediaElementAudioSourceNode(this, { mediaElement }) }
}

export default BaseAudioContext
