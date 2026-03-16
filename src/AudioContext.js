import { BufferEncoder, decodeAudioData } from './utils.js'
import { BLOCK_SIZE } from './constants.js'
import AudioBuffer from 'audio-buffer'
import AudioListener from './AudioListener.js'
import AudioDestinationNode from './AudioDestinationNode.js'
import AudioBufferSourceNode from './AudioBufferSourceNode.js'
import GainNode from './GainNode.js'
import ScriptProcessorNode from './ScriptProcessorNode.js'
import PannerNode from './PannerNode/index.js'


class AudioContext extends EventTarget {
  #state = 'running'
  #frame = 0
  #loopRunning = false
  #sampleRate
  #numberOfChannels
  #bitDepth
  #encoder
  #destination
  #listener
  #onstatechange = null

  constructor(opts) {
    super()
    opts = opts || {}

    this.#sampleRate = opts.sampleRate || 44100
    this.#numberOfChannels = opts.numberOfChannels || 2
    this.#bitDepth = opts.bitDepth || 16

    this.#destination = new AudioDestinationNode(this)
    this.#listener = new AudioListener()

    this.format = {
      numberOfChannels: this.#numberOfChannels,
      bitDepth: this.#bitDepth,
      sampleRate: this.#sampleRate
    }
    if (opts.bufferSize) this.format.bufferSize = opts.bufferSize
    if (opts.numBuffers) this.format.numBuffers = opts.numBuffers

    this.#encoder = BufferEncoder(this.format)
    this.outStream = null

    // When a new connection is established, start to pull audio
    this.#destination._inputs[0].on('connection', () => {
      if (this.#loopRunning || this.#state !== 'running') return
      if (!this.outStream) throw new Error('you need to set outStream to send the audio somewhere')
      this.#loopRunning = true
      this._renderLoop()
    })
  }

  get destination() { return this.#destination }
  get listener() { return this.#listener }
  get sampleRate() { return this.#sampleRate }
  get numberOfChannels() { return this.#numberOfChannels }
  get currentTime() { return this.#frame / this.#sampleRate }
  get state() { return this.#state }
  get baseLatency() { return BLOCK_SIZE / this.#sampleRate }
  get outputLatency() { return BLOCK_SIZE / this.#sampleRate }

  get onstatechange() { return this.#onstatechange }
  set onstatechange(fn) {
    if (this.#onstatechange) this.removeEventListener('statechange', this.#onstatechange)
    this.#onstatechange = fn
    if (fn) this.addEventListener('statechange', fn)
  }

  #setState(state) {
    if (this.#state === state) return
    this.#state = state
    this.dispatchEvent(new Event('statechange'))
  }

  suspend() {
    return new Promise(resolve => {
      this.#setState('suspended')
      resolve()
    })
  }

  resume() {
    return new Promise(resolve => {
      this.#setState('running')
      // restart render loop if connections exist and stream is set
      if (!this.#loopRunning && this.outStream && this.#destination._inputs[0].sources.length) {
        this.#loopRunning = true
        this._renderLoop()
      }
      resolve()
    })
  }

  close() {
    return new Promise(resolve => {
      this.#setState('closed')
      if (this.outStream) this.outStream.close?.() || this.outStream.end?.()
      resolve()
    })
  }

  // Single render quantum: pull graph, advance time, encode output
  _render() {
    let outBuff = this.#destination._tick()
    this.#frame += BLOCK_SIZE
    return this.#encoder(outBuff._channels)
  }

  // Real-time render loop: write to outStream, schedule next tick
  _renderLoop() {
    if (this.#state !== 'running') { this.#loopRunning = false; return }
    try {
      let encoded = this._render()
      if (this.outStream.write(encoded)) setTimeout(() => this._renderLoop(), 0)
      else this.outStream.once('drain', () => this._renderLoop())
    } catch (e) {
      this.#loopRunning = false
      if (e) this.dispatchEvent(new CustomEvent('error', { detail: e }))
    }
  }

  createBuffer(numberOfChannels, length, sampleRate) {
    return new AudioBuffer(numberOfChannels, length, sampleRate)
  }

  decodeAudioData(audioData, successCallback, errorCallback) {
    let promise = decodeAudioData(audioData)
    if (successCallback) promise.then(successCallback, errorCallback)
    return promise
  }

  createBufferSource() { return new AudioBufferSourceNode(this) }
  createGain() { return new GainNode(this) }
  createScriptProcessor(bufferSize, inCh, outCh) { return new ScriptProcessorNode(this, bufferSize, inCh, outCh) }
  createPanner() { return new PannerNode(this) }

  [Symbol.dispose]() {
    this.#setState('closed')
    if (this.outStream) this.outStream.close?.() || this.outStream.end?.()
  }
}

export default AudioContext
