import events from 'events'
import { BufferEncoder, decodeAudioData } from './utils.js'
import { BLOCK_SIZE } from './constants.js'
import AudioBuffer from 'audio-buffer'
import AudioListener from './AudioListener.js'
import AudioDestinationNode from './AudioDestinationNode.js'
import AudioBufferSourceNode from './AudioBufferSourceNode.js'
import GainNode from './GainNode.js'
import ScriptProcessorNode from './ScriptProcessorNode.js'
import PannerNode from './PannerNode/index.js'


class AudioContext extends events.EventEmitter {
  #playing = false
  #frame = 0
  #loopRunning = false
  #sampleRate
  #encoder

  constructor(opts) {
    super()
    opts = opts || {}

    this.#sampleRate = opts.sampleRate || 44100
    this.numberOfChannels = opts.numberOfChannels || 2
    this.bitDepth = opts.bitDepth || 16

    Object.defineProperty(this, 'destination', {
      writable: false,
      value: new AudioDestinationNode(this)
    })

    Object.defineProperty(this, 'listener', {
      writable: false,
      value: new AudioListener(),
    })

    this.format = {
      numberOfChannels: this.numberOfChannels,
      bitDepth: this.bitDepth,
      sampleRate: this.#sampleRate
    }
    if (opts.bufferSize) this.format.bufferSize = opts.bufferSize
    if (opts.numBuffers) this.format.numBuffers = opts.numBuffers

    this.#encoder = BufferEncoder(this.format)
    this.outStream = null

    this.#playing = true

    // When a new connection is established, start to pull audio
    this.destination._inputs[0].on('connection', () => {
      if (this.#loopRunning || !this.#playing) return
      if (!this.outStream) throw new Error('you need to set outStream to send the audio somewhere')
      this.#loopRunning = true
      this._renderLoop()
    })
  }

  get sampleRate() { return this.#sampleRate }

  get currentTime() { return this.#frame / this.#sampleRate }

  // Single render quantum: pull graph, advance time, encode output
  _render() {
    let outBuff = this.destination._tick()
    this.#frame += BLOCK_SIZE
    return this.#encoder(outBuff._data)
  }

  // Real-time render loop: write to outStream, schedule next tick
  _renderLoop() {
    if (!this.#playing) return
    try {
      let encoded = this._render()
      if (this.outStream.write(encoded)) setImmediate(() => this._renderLoop())
      else this.outStream.once('drain', () => this._renderLoop())
    } catch (e) {
      this.#loopRunning = false
      if (e) this.emit('error', e)
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

  [Symbol.dispose]() {
    this.#playing = false
    if (this.outStream) this.outStream.close?.() || this.outStream.end?.()
  }
}

export default AudioContext
