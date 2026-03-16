import events from 'events'
import AudioBuffer from './AudioBuffer.js'
import { BLOCK_SIZE } from './constants.js'
import ChannelMixing from './ChannelMixing.js'


class AudioPort extends events.EventEmitter {

  constructor(context, node, id) {
    super()
    this.connections = []
    this.node = node
    this.id = id
    this.context = context
  }

  // Generic function for connecting the calling AudioPort
  // with `otherPort`. Returns true if a connection was indeed established
  connect(otherPort) {
    if (this.connections.indexOf(otherPort) !== -1) return false
    this.connections.push(otherPort)
    otherPort.connect(this)
    this.emit('connection', otherPort)
    return true
  }

  // Generic function for disconnecting the calling AudioPort
  // from `otherPort`. Returns true if a disconnection was indeed made
  disconnect(otherPort) {
    var connInd = this.connections.indexOf(otherPort)
    if (connInd === -1) return false
    this.connections.splice(connInd, 1)
    otherPort.disconnect(this)
    this.emit('disconnection', otherPort)
    return true
  }

  // Called when a node is killed. Removes connections, and event listeners.
  [Symbol.dispose]() {
    this.connections.slice(0).forEach((port) => {
      this.disconnect(port)
    })
    this.removeAllListeners()
  }

}

class AudioInput extends AudioPort {

  constructor(context, node, id) {
    super(context, node, id)

    // `computedNumberOfChannels` is scheduled to be recalculated everytime a connection
    // or disconnection happens.
    this.computedNumberOfChannels = null
    this.on('connection', () => {
      this.computedNumberOfChannels = null
      this._mixCache = null
    })
    this.on('disconnection', () => {
      this.computedNumberOfChannels = null
      this._mixCache = null
    })
  }

  get sources() { return this.connections }

  connect(source) {
    // When the number of channels of the source changes, we trigger
    // computation of `computedNumberOfChannels`
    source.on('_numberOfChannels', () => {
      this.computedNumberOfChannels = null
    })
    //AudioPort.prototype.connect.call(this, source)
    super.connect(source)
  }

  disconnect(source) {
    source.removeAllListeners('_numberOfChannels')
    //AudioPort.prototype.disconnect.call(this, source)
    super.disconnect(source)
  }

  _tick() {
    var inBuffers = this.sources.map(source => source._tick())

    if (this.computedNumberOfChannels === null) {
      var maxChannelsUpstream = this.sources.length
        ? inBuffers.reduce((m, buf) => Math.max(m, buf.numberOfChannels), 0)
        : 0
      this._computeNumberOfChannels(maxChannelsUpstream)
    }

    // reallocate only when channel count changes
    if (!this._mixBuf || this._mixBuf.numberOfChannels !== this.computedNumberOfChannels) {
      this._mixBuf = new AudioBuffer(this.computedNumberOfChannels, BLOCK_SIZE, this.context.sampleRate)
    } else {
      // zero the reused buffer
      for (let ch = 0; ch < this._mixBuf.numberOfChannels; ch++)
        this._mixBuf.getChannelData(ch).fill(0)
    }

    inBuffers.forEach((inBuffer) => {
      let key = inBuffer.numberOfChannels + ':' + this.computedNumberOfChannels + ':' + this.node.channelInterpretation
      let mix = this._mixCache?.get(key)
      if (!mix) {
        mix = new ChannelMixing(inBuffer.numberOfChannels, this.computedNumberOfChannels, this.node.channelInterpretation)
        if (!this._mixCache) this._mixCache = new Map()
        this._mixCache.set(key, mix)
      }
      mix.process(inBuffer, this._mixBuf)
    })
    return this._mixBuf
  }

  _computeNumberOfChannels(maxChannelsUpstream) {
    var countMode = this.node.channelCountMode,
      channelCount = this.node.channelCount
    maxChannelsUpstream = maxChannelsUpstream || 1

    if (countMode === 'max') {
      this.computedNumberOfChannels = maxChannelsUpstream
    } else if (countMode === 'clamped-max') {
      this.computedNumberOfChannels = Math.min(maxChannelsUpstream, channelCount)
    } else if (countMode === 'explicit')
      this.computedNumberOfChannels = channelCount
      // this shouldn't happen
    else throw new Error('invalid channelCountMode')
  }

}

class AudioOutput extends AudioPort {

  constructor(context, node, id) {
    super(context, node, id)

    // This caches the block fetched from the node.
    this._cachedBlock = {
      time: -1,
      buffer: null
    }

    // This catches the number of channels of the audio going through this output
    this._numberOfChannels = null
  }

  get sinks() { return this.connections }

  // Pulls the audio from the node only once, and copies it so that several
  // nodes downstream can pull the same block.
  _tick() {
    if (this._cachedBlock.time < this.context.currentTime) {
      var outBuffer = this.node._tick()
      if (this._numberOfChannels !== outBuffer.numberOfChannels) {
        this._numberOfChannels = outBuffer.numberOfChannels
        this.emit('_numberOfChannels')
      }
      this._cachedBlock.time = this.context.currentTime
      this._cachedBlock.buffer = outBuffer
      return outBuffer
    } else return this._cachedBlock.buffer
  }

}

export {
  AudioOutput,
  AudioInput
}
