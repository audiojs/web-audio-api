import AudioNode from './AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'

// Reads audio from a readable stream/source and outputs it to the graph
class MediaStreamAudioSourceNode extends AudioNode {

  #stream
  #buffer
  #readPos = 0
  #channelCount

  constructor(context, options) {
    options = AudioNode._checkOpts(options)
    let numberOfChannels = options.numberOfChannels ?? 1
    super(context, 0, 1, numberOfChannels, 'max', 'speakers')
    this.#stream = options.mediaStream
    this.#channelCount = numberOfChannels
    this.#buffer = [] // accumulated Float32Array chunks per channel
    this._outBuf = new AudioBuffer(numberOfChannels, BLOCK_SIZE, context.sampleRate)
    this._applyOpts(options)
  }

  // Push audio data into the node (called externally or from stream)
  pushData(channelData) {
    this.#buffer.push(channelData)
  }

  _tick() {
    super._tick()
    let out = this._outBuf
    // zero output
    for (let ch = 0; ch < this.#channelCount; ch++) out.getChannelData(ch).fill(0)

    // try to fill from accumulated buffer
    if (this.#buffer.length > 0) {
      let chunk = this.#buffer[0]
      let chCount = Math.min(this.#channelCount, Array.isArray(chunk) ? chunk.length : 1)
      for (let ch = 0; ch < chCount; ch++) {
        let src = Array.isArray(chunk) ? chunk[ch] : chunk
        let dst = out.getChannelData(ch)
        let available = src.length - this.#readPos
        let count = Math.min(BLOCK_SIZE, available)
        for (let i = 0; i < count; i++) dst[i] = src[this.#readPos + i]
      }
      this.#readPos += BLOCK_SIZE
      if (this.#readPos >= (Array.isArray(chunk) ? chunk[0].length : chunk.length)) {
        this.#buffer.shift()
        this.#readPos = 0
      }
    }

    return out
  }
}


// Writes audio graph output to a writable stream/destination
class MediaStreamAudioDestinationNode extends AudioNode {

  #stream

  get stream() { return this.#stream }

  constructor(context, options) {
    options = AudioNode._checkOpts(options)
    let numberOfChannels = options.numberOfChannels ?? 2
    super(context, 1, 0, numberOfChannels, 'explicit', 'speakers')
    // create a simple readable interface
    this.#stream = {
      _buffers: [],
      read() { return this._buffers.shift() || null },
      get readable() { return this._buffers.length > 0 }
    }
  }

  _tick() {
    super._tick()
    let inBuf = this._inputs[0]._tick()
    // push channel data to stream
    let channels = []
    for (let ch = 0; ch < inBuf.numberOfChannels; ch++)
      channels.push(new Float32Array(inBuf.getChannelData(ch)))
    this.#stream._buffers.push(channels)
    return inBuf
  }
}

export { MediaStreamAudioSourceNode, MediaStreamAudioDestinationNode }
