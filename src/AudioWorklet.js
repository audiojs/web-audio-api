import AudioNode from './AudioNode.js'
import AudioParam from './AudioParam.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'


// AudioWorkletProcessor — base class users extend
class AudioWorkletProcessor {
  constructor() {
    // port is wired by AudioWorkletNode after construction
    this.port = null
  }

  // subclass overrides: process(inputs, outputs, parameters) → boolean
  process() { return true }

  static get parameterDescriptors() { return [] }
}


// AudioWorkletGlobalScope — processor registry
class AudioWorkletGlobalScope {
  #processors = new Map()

  registerProcessor(name, processorClass) {
    if (this.#processors.has(name)) throw new Error(`Processor "${name}" already registered`)
    if (!(processorClass.prototype instanceof AudioWorkletProcessor) && processorClass !== AudioWorkletProcessor)
      throw new Error('processorClass must extend AudioWorkletProcessor')
    this.#processors.set(name, processorClass)
  }

  _getProcessor(name) {
    let cls = this.#processors.get(name)
    if (!cls) throw new Error(`Processor "${name}" not registered`)
    return cls
  }
}


// AudioWorkletNode — audio node backed by a processor instance
class AudioWorkletNode extends AudioNode {

  #processor
  #paramMap = new Map()
  #alive = true
  #nodePort   // node-side port exposed to user
  #procPort   // processor-side port

  get port() { return this.#nodePort }
  get parameters() { return this.#paramMap }

  constructor(context, processorName, options = {}) {
    let numberOfInputs = options.numberOfInputs ?? 1
    let numberOfOutputs = options.numberOfOutputs ?? 1
    let outputChannelCount = options.outputChannelCount ?? [2]
    let channelCount = options.channelCount ?? outputChannelCount[0] ?? 2

    // normalize outputChannelCount to match numberOfOutputs
    while (outputChannelCount.length < numberOfOutputs)
      outputChannelCount.push(channelCount)
    if (outputChannelCount.length > numberOfOutputs)
      outputChannelCount = outputChannelCount.slice(0, numberOfOutputs)

    super(context, numberOfInputs, numberOfOutputs, channelCount, 'explicit', 'speakers')

    // resolve processor class from context's worklet scope
    let scope = context._workletScope
    if (!scope) throw new Error('No AudioWorklet scope — call context.audioWorklet.addModule() first')
    let ProcessorClass = scope._getProcessor(processorName)

    this.#processor = new ProcessorClass()

    // wire entangled message ports: node ↔ processor
    let channel = new MessageChannel()
    this.#nodePort = channel.port1
    this.#procPort = channel.port2
    this.#processor.port = this.#procPort

    // create AudioParams from parameterDescriptors
    let descriptors = ProcessorClass.parameterDescriptors || []
    for (let desc of descriptors) {
      let param = new AudioParam(context, desc.defaultValue ?? 0, desc.automationRate === 'k-rate' ? 'k' : 'a')
      this.#paramMap.set(desc.name, param)
    }

    // pre-allocate output buffers
    this._outBufs = outputChannelCount.map(ch =>
      new AudioBuffer(ch, BLOCK_SIZE, context.sampleRate))
  }

  _tick() {
    super._tick()
    if (!this.#alive) {
      // dead node → output silence
      let buf = this._outBufs[0]
      for (let ch = 0; ch < buf.numberOfChannels; ch++) buf.getChannelData(ch).fill(0)
      return buf
    }

    // gather inputs
    let inputs = []
    for (let i = 0; i < this.numberOfInputs; i++) {
      let buf = this._inputs[i]._tick()
      let chArrays = []
      for (let ch = 0; ch < buf.numberOfChannels; ch++)
        chArrays.push(buf.getChannelData(ch))
      inputs.push(chArrays)
    }

    // prepare outputs (zeroed)
    let outputs = []
    for (let i = 0; i < this.numberOfOutputs; i++) {
      let buf = this._outBufs[i]
      let chArrays = []
      for (let ch = 0; ch < buf.numberOfChannels; ch++) {
        let d = buf.getChannelData(ch)
        d.fill(0)
        chArrays.push(d)
      }
      outputs.push(chArrays)
    }

    // gather parameters
    let parameters = {}
    for (let [name, param] of this.#paramMap)
      parameters[name] = param._tick()

    // call processor
    let keepAlive = this.#processor.process(inputs, outputs, parameters)
    if (!keepAlive) this.#alive = false

    return this._outBufs[0]
  }
}


// AudioWorklet — attached to context, provides addModule()
class AudioWorklet {
  #context
  #scope = new AudioWorkletGlobalScope()

  constructor(context) {
    this.#context = context
    context._workletScope = this.#scope
  }

  async addModule(moduleOrSetup) {
    if (typeof moduleOrSetup === 'function') moduleOrSetup(this.#scope)
  }

  get _scope() { return this.#scope }
}


export { AudioWorkletNode, AudioWorkletProcessor, AudioWorkletGlobalScope, AudioWorklet }
