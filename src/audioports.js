import Emitter from './Emitter.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'
import ChannelMixing from './ChannelMixing.js'


class AudioPort extends Emitter() {

  constructor(context, node, id) {
    super()
    this.connections = []
    this.node = node
    this.id = id
    this.context = context
  }

  connect(otherPort) {
    if (this.connections.includes(otherPort)) return false
    this.connections.push(otherPort)
    otherPort.connect(this)
    this.emit('connection')
    return true
  }

  disconnect(otherPort) {
    let idx = this.connections.indexOf(otherPort)
    if (idx === -1) return false
    this.connections.splice(idx, 1)
    otherPort.disconnect(this)
    this.emit('disconnection')
    return true
  }

  [Symbol.dispose]() {
    this.connections.slice(0).forEach(port => this.disconnect(port))
    this.removeAllListeners()
  }
}

class AudioInput extends AudioPort {

  constructor(context, node, id) {
    super(context, node, id)

    this.computedNumberOfChannels = null
    this.on('connection', () => {
      this.computedNumberOfChannels = null
      this._mixCache = null
    })
    this.on('disconnection', () => {
      this.computedNumberOfChannels = null
      this._mixCache = null
    })
    this._chHandlers = new WeakMap()
  }

  get sources() { return this.connections }

  connect(source) {
    if (this.connections.includes(source)) return false
    let handler = () => { this.computedNumberOfChannels = null }
    this._chHandlers.set(source, handler)
    source.on('_numberOfChannels', handler)
    super.connect(source)
  }

  disconnect(source) {
    let handler = this._chHandlers.get(source)
    if (handler) { source.off('_numberOfChannels', handler); this._chHandlers.delete(source) }
    super.disconnect(source)
  }

  _tick() {
    let inBuffers = this.sources.slice().map(source => source._tick())

    if (this.computedNumberOfChannels === null) {
      let maxUp = this.sources.length
        ? inBuffers.reduce((m, buf) => Math.max(m, buf.numberOfChannels), 0)
        : 0
      this._computeNumberOfChannels(maxUp)
    }

    if (!this._mixBuf || this._mixBuf.numberOfChannels !== this.computedNumberOfChannels) {
      this._mixBuf = new AudioBuffer(this.computedNumberOfChannels, BLOCK_SIZE, this.context.sampleRate)
      // AudioParam inputs use Float64Array to avoid intermediate float32 rounding
      // that would cause precision mismatch vs direct automation
      if (this._useFloat64) {
        for (let ch = 0; ch < this.computedNumberOfChannels; ch++)
          this._mixBuf._channels[ch] = new Float64Array(BLOCK_SIZE)
      }
    } else {
      for (let ch = 0; ch < this._mixBuf.numberOfChannels; ch++)
        this._mixBuf.getChannelData(ch).fill(0)
    }

    let interp = this.node.channelInterpretation
    let outCh = this.computedNumberOfChannels
    for (let inBuffer of inBuffers) {
      let inCh = inBuffer.numberOfChannels
      let key = (inCh << 16) | (outCh << 8) | (interp === 'speakers' ? 0 : 1)
      let mix = this._mixCache?.get(key)
      if (!mix) {
        mix = new ChannelMixing(inCh, outCh, interp)
        if (!this._mixCache) this._mixCache = new Map()
        this._mixCache.set(key, mix)
      }
      mix.process(inBuffer, this._mixBuf)
    }
    return this._mixBuf
  }

  _computeNumberOfChannels(maxChannelsUpstream) {
    let countMode = this.node.channelCountMode
    let channelCount = this.node.channelCount
    maxChannelsUpstream = maxChannelsUpstream || 1

    if (countMode === 'max') this.computedNumberOfChannels = maxChannelsUpstream
    else if (countMode === 'clamped-max') this.computedNumberOfChannels = Math.min(maxChannelsUpstream, channelCount)
    else if (countMode === 'explicit') this.computedNumberOfChannels = channelCount
    else throw new Error('invalid channelCountMode')
  }

}

class AudioOutput extends AudioPort {

  constructor(context, node, id) {
    super(context, node, id)
    this._cachedBlock = { time: -1, buffer: null }
    this._numberOfChannels = null
    this._ticking = false
  }

  get sinks() { return this.connections }

  _tick() {
    // Cycle detection: if this output is already being pulled, return cached or silence
    let ctx = this.context
    let cycle = ctx._cycle || (ctx._cycle = { delayCount: 0, withoutDelay: false, detected: false, deferred: null })
    if (this._ticking) {
      // Spec: cycles without DelayNode must be muted.
      if (!cycle.delayCount) cycle.withoutDelay = true
      else cycle.detected = true
      return this._cachedBlock.buffer || new AudioBuffer(1, BLOCK_SIZE, ctx.sampleRate)
    }

    if (this._cachedBlock.time < ctx.currentTime) {
      this._ticking = true
      let prevCycleFlag = cycle.withoutDelay
      cycle.withoutDelay = false
      // _tickOutput allows nodes like ChannelSplitterNode to return different buffers per output
      let outBuffer = this.node._tickOutput ? this.node._tickOutput(this.id) : this.node._tick()
      // Spec: if a no-delay cycle was detected, mute this node's output
      let hasCycleWithoutDelay = cycle.withoutDelay
      cycle.withoutDelay = prevCycleFlag
      if (hasCycleWithoutDelay) {
        outBuffer = new AudioBuffer(outBuffer.numberOfChannels, BLOCK_SIZE, this.context.sampleRate)
      }
      if (this._numberOfChannels !== outBuffer.numberOfChannels) {
        this._numberOfChannels = outBuffer.numberOfChannels
        this.emit('_numberOfChannels')
      }
      this._cachedBlock.time = this.context.currentTime
      this._cachedBlock.buffer = outBuffer
      this._ticking = false
      return outBuffer
    }
    return this._cachedBlock.buffer
  }

}

export { AudioOutput, AudioInput }
