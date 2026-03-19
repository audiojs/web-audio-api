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


// AudioWorkletGlobalScope — processor registry + global scope for worklet code
class AudioWorkletGlobalScope {
  #processors = new Map()
  port = null // MessagePort — wired by AudioWorklet.addModule

  registerProcessor(name, processorClass) {
    if (this.#processors.has(name))
      throw new DOMException(`Processor "${name}" already registered`, 'NotSupportedError')
    if (!(processorClass.prototype instanceof AudioWorkletProcessor) && processorClass !== AudioWorkletProcessor)
      throw new TypeError('processorClass must extend AudioWorkletProcessor')

    // Validate parameterDescriptors per spec
    let descriptors = processorClass.parameterDescriptors
    if (descriptors !== undefined) {
      if (descriptors == null || typeof descriptors[Symbol.iterator] !== 'function')
        throw new TypeError('parameterDescriptors must be iterable')
      let names = new Set()
      for (let d of descriptors) {
        if (names.has(d.name))
          throw new DOMException(`Duplicate parameter name "${d.name}"`, 'NotSupportedError')
        names.add(d.name)
        let min = d.minValue ?? -3.4028235e38
        let max = d.maxValue ?? 3.4028235e38
        let def = d.defaultValue ?? 0
        if (def < min || def > max)
          throw new DOMException(`defaultValue ${def} out of range [${min}, ${max}]`, 'InvalidStateError')
      }
    }
    this.#processors.set(name, processorClass)
  }

  _getProcessor(name) {
    let cls = this.#processors.get(name)
    if (!cls) throw new DOMException(`Processor "${name}" not registered`, 'InvalidStateError')
    return cls
  }
}


// AudioWorkletNode — audio node backed by a processor instance
class AudioWorkletNode extends AudioNode {

  #processor
  #paramMap = new Map()
  #alive = true
  #nodePort   // node-side port exposed to user
  #onprocessorerror
  #procPort   // processor-side port

  get port() { return this.#nodePort }
  get parameters() { return this.#paramMap }
  get onprocessorerror() { return this.#onprocessorerror }
  set onprocessorerror(fn) {
    if (this.#onprocessorerror) this.removeEventListener('processorerror', this.#onprocessorerror)
    this.#onprocessorerror = fn
    if (fn) this.addEventListener('processorerror', fn)
  }

  constructor(context, processorName, options) {
    options = AudioNode._checkOpts(options)
    let numberOfInputs = options.numberOfInputs ?? 1
    let numberOfOutputs = options.numberOfOutputs ?? 1
    let outputChannelCount = options.outputChannelCount ?? [2]
    let channelCount = options.channelCount ?? outputChannelCount[0] ?? 2

    // normalize outputChannelCount to match numberOfOutputs
    while (outputChannelCount.length < numberOfOutputs)
      outputChannelCount.push(channelCount)
    if (outputChannelCount.length > numberOfOutputs)
      outputChannelCount = outputChannelCount.slice(0, numberOfOutputs)

    super(context, numberOfInputs, numberOfOutputs, channelCount, 'max', 'speakers')
    this._applyOpts(options)

    // onprocessorerror event handler property
    this.#onprocessorerror = null

    // resolve processor class from context's worklet scope
    let scope = context._workletScope
    if (!scope) throw new Error('No AudioWorklet scope — call context.audioWorklet.addModule() first')
    let ProcessorClass = scope._getProcessor(processorName)

    try {
      this.#processor = new ProcessorClass(options)
    } catch (e) {
      // Spec: constructor errors fire onprocessorerror
      queueMicrotask(() => {
        let ev = new (globalThis.ErrorEvent || Event)('processorerror', { error: e, message: e?.message })
  
        this.dispatchEvent(ev)
      })
      this.#processor = null
    }

    // wire entangled message ports: node ↔ processor
    let channel = new MessageChannel()
    this.#nodePort = channel.port1
    this.#procPort = channel.port2
    if (this.#processor) this.#processor.port = this.#procPort

    // create AudioParams from parameterDescriptors
    let descriptors = ProcessorClass.parameterDescriptors || []
    for (let desc of descriptors) {
      let param = new AudioParam(context, desc.defaultValue ?? 0, desc.automationRate === 'k-rate' ? 'k' : 'a', desc.minValue, desc.maxValue)
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

    // gather inputs — per spec, disconnected inputs have zero channels
    let inputs = []
    for (let i = 0; i < this.numberOfInputs; i++) {
      if (this._inputs[i].sources.length === 0) {
        inputs.push([]) // no connections = empty channel array
      } else {
        let buf = this._inputs[i]._tick()
        let chArrays = []
        for (let ch = 0; ch < buf.numberOfChannels; ch++)
          chArrays.push(buf.getChannelData(ch))
        inputs.push(chArrays)
      }
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
    for (let [name, param] of this.#paramMap) {
      let vals = param._tick()
      // Per spec: k-rate params produce Float32Array of length 1
      if (param.automationRate === 'k-rate')
        parameters[name] = new Float32Array([vals[0]])
      else
        parameters[name] = vals
    }

    // call processor — catch errors and fire onprocessorerror
    if (!this.#processor) return this._outBufs[0]
    let keepAlive
    try {
      keepAlive = this.#processor.process(inputs, outputs, parameters)
    } catch (e) {
      let ev = new (globalThis.ErrorEvent || Event)('processorerror', { error: e, message: e?.message })

      this.dispatchEvent(ev)
      this.#alive = false
      return this._outBufs[0]
    }
    if (!keepAlive) this.#alive = false

    return this._outBufs[0]
  }
}


// AudioWorklet — attached to context, provides addModule()
class AudioWorklet {
  #scope = new AudioWorkletGlobalScope()
  #context

  #port // main-thread side port for global scope messaging

  constructor(context) {
    this.#context = context
    context._workletScope = this.#scope
    // Wire up global scope port
    let channel = new MessageChannel()
    this.#port = channel.port1
    this.#scope.port = channel.port2
  }

  get port() { return this.#port }

  async addModule(moduleOrSetup) {
    if (typeof moduleOrSetup === 'function') return moduleOrSetup(this.#scope)

    if (typeof moduleOrSetup !== 'string')
      throw new TypeError('addModule requires a URL string or setup function')

    let code = await this.#readModule(moduleOrSetup)
    let scope = this.#scope
    let regFn = (name, cls) => scope.registerProcessor(name, cls)

    // Run processor code with AudioWorkletGlobalScope globals
    let ctx = this.#context
    let args = {
      registerProcessor: regFn,
      AudioWorkletProcessor,
      sampleRate: ctx.sampleRate,
      currentTime: ctx.currentTime,
      currentFrame: ctx._frame,
      port: scope.port,
    }
    let names = Object.keys(args)
    new Function(...names, code)(...names.map(k => args[k]))
  }

  async #readModule(url) {
    // Allow custom reader (e.g. for test runners with vm sandboxes or blob URLs)
    if (this.#context._readModule) return this.#context._readModule(url)

    // Dynamic import fs/path — works in Node.js, throws in browser
    let fs, path
    try { fs = await import('fs'); path = await import('path') } catch {
      throw new Error('addModule(url) with string requires Node.js; use addModule(fn) in browser')
    }

    let rel = url.startsWith('/') ? url.slice(1) : url
    let base = this.#context._basePath || process.cwd()
    return fs.readFileSync(path.resolve(base, rel), 'utf8')
  }

  get _scope() { return this.#scope }
}


export { AudioWorkletNode, AudioWorkletProcessor, AudioWorkletGlobalScope, AudioWorklet }
