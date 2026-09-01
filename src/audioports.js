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
    // A new upstream connection can carry signal earlier than any cached horizon
    this.node._wake?.()
  }

  disconnect(source) {
    let handler = this._chHandlers.get(source)
    if (handler) { source.off('_numberOfChannels', handler); this._chHandlers.delete(source) }
    super.disconnect(source)
  }

  _tick() {
    // Snapshot connections into reusable scratch arrays: a pull can fire scheduled
    // events that disconnect sources mid-iteration, and per-quantum allocations
    // dominate large graphs of mostly-idle scheduled sources
    let connections = this.connections
    let count = connections.length
    let sources = this._srcScratch || (this._srcScratch = [])
    sources.length = count
    for (let i = 0; i < count; i++) sources[i] = connections[i]
    let ctx = this.context
    let blockEnd = ctx._frame != null
      ? (ctx._frame + BLOCK_SIZE) / ctx.sampleRate
      : ctx.currentTime + BLOCK_SIZE / ctx.sampleRate
    // Sleeping outputs are provably silent this quantum — represent them by a
    // shared 1-channel silent block (matching what an idle source returns)
    let silent = this._silentBuf || (this._silentBuf = Object.assign(new AudioBuffer(1, BLOCK_SIZE, ctx.sampleRate), { _silent: true }))
    let inBuffers = this._bufScratch || (this._bufScratch = [])
    inBuffers.length = count
    for (let i = 0; i < count; i++)
      inBuffers[i] = sources[i]._horizon(blockEnd) > blockEnd ? silent : sources[i]._tick()

    if (this.computedNumberOfChannels === null) {
      let maxUp = 0
      for (let i = 0; i < count; i++) maxUp = Math.max(maxUp, inBuffers[i].numberOfChannels)
      this._computeNumberOfChannels(maxUp)
    }

    // Fast path: single source with matching channels — skip mix buffer entirely
    if (inBuffers.length === 1 && !this._useFloat64 &&
        inBuffers[0].numberOfChannels === this.computedNumberOfChannels) {
      return inBuffers[0]
    }

    if (!this._mixBuf || this._mixBuf.numberOfChannels !== this.computedNumberOfChannels) {
      this._mixBuf = new AudioBuffer(this.computedNumberOfChannels, BLOCK_SIZE, this.context.sampleRate)
      this._mixBuf._silent = true // fresh buffers are zeroed
      // AudioParam inputs use Float64Array to avoid intermediate float32 rounding
      // that would cause precision mismatch vs direct automation
      if (this._useFloat64) {
        for (let ch = 0; ch < this.computedNumberOfChannels; ch++)
          this._mixBuf._channels[ch] = new Float64Array(BLOCK_SIZE)
      }
    } else if (!this._mixBuf._silent) {
      for (let ch = 0; ch < this._mixBuf.numberOfChannels; ch++)
        this._mixBuf.getChannelData(ch).fill(0)
    }

    let interp = this.node.channelInterpretation
    let outCh = this.computedNumberOfChannels
    let mixed = false
    for (let inBuffer of inBuffers) {
      if (inBuffer._silent) continue // all-zero block contributes nothing
      mixed = true
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
    this._mixBuf._silent = !mixed
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
    this._silentUntil = -Infinity // cached sleep horizon; -Infinity = active/unknown
    this._horizonBusy = false
  }

  get sinks() { return this.connections }

  // Time until which this output is provably silent. Inputs skip pulling a
  // sleeping output entirely, so graphs of scheduled-but-idle sources cost
  // nothing per quantum. A future horizon is cached; it can only move earlier
  // through API calls (start, connect), which wake the downstream subgraph.
  _horizon(blockEnd) {
    if (this._silentUntil > blockEnd) return this._silentUntil
    let node = this.node
    if (!node._silentUntil || this._horizonBusy) return -Infinity
    this._horizonBusy = true
    let horizon = node._silentUntil(blockEnd)
    this._horizonBusy = false
    if (horizon > blockEnd) this._silentUntil = horizon
    return horizon
  }

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
