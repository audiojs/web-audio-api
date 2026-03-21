import AudioNode from './AudioNode.js'
import AudioParam from './AudioParam.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'


// Pending port for processor construction — set before instantiation, consumed by super()
// _CONSUMED sentinel means a construction is active but the port was already claimed.
let _pendingPort = null
const _CONSUMED = Symbol('consumed')

// AudioWorkletProcessor — base class users extend
class AudioWorkletProcessor {
  constructor() {
    // Per spec: during AudioWorkletNode construction, only one super()/new call
    // may consume the pending port. A second call throws TypeError.
    if (_pendingPort === _CONSUMED)
      throw new TypeError('AudioWorkletProcessor constructor may only be called once per node construction')
    // When called outside node construction (e.g. direct instantiation), port is null
    this.port = _pendingPort
    if (_pendingPort !== null) _pendingPort = _CONSUMED
  }

  // Per spec: no default process() — subclasses must define it.
  // Calling process on a processor without one triggers processorerror.

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


// Check if all values in a Float32Array are the same (constant)
function _isConstant(arr) {
  let v = arr[0]
  for (let i = 1; i < arr.length; i++)
    if (arr[i] !== v) return false
  return true
}

// AudioWorkletNode — audio node backed by a processor instance
class AudioWorkletNode extends AudioNode {

  #processor
  #paramMap = new Map()
  #alive = true
  #nodePort   // node-side port exposed to user
  #onprocessorerror
  #procPort   // processor-side port
  #dynamicOutput // true when outputChannelCount was not explicitly set

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
    let dynamicOutput = !options.outputChannelCount
    let outputChannelCount = options.outputChannelCount ?? [1]
    let channelCount = options.channelCount ?? (dynamicOutput ? 2 : outputChannelCount[0] ?? 2)

    // normalize outputChannelCount to match numberOfOutputs
    while (outputChannelCount.length < numberOfOutputs)
      outputChannelCount.push(dynamicOutput ? 1 : channelCount)
    if (outputChannelCount.length > numberOfOutputs)
      outputChannelCount = outputChannelCount.slice(0, numberOfOutputs)

    super(context, numberOfInputs, numberOfOutputs, channelCount, 'max', 'speakers')
    this._applyOpts(options)
    this.#dynamicOutput = dynamicOutput

    // onprocessorerror event handler property
    this.#onprocessorerror = null

    // resolve processor class from context's worklet scope
    let scope = context._workletScope
    if (!scope) throw new Error('No AudioWorklet scope — call context.audioWorklet.addModule() first')
    let ProcessorClass = scope._getProcessor(processorName)

    // wire entangled message ports: node ↔ processor
    // Port must be available during processor constructor (via _pendingPort)
    let channel = new MessageChannel()
    this.#nodePort = channel.port1
    this.#procPort = channel.port2

    // Build resolved options dict for processor constructor (per spec)
    let procOptions = {
      numberOfInputs,
      numberOfOutputs,
      outputChannelCount: outputChannelCount.slice(),
    }
    if (options.parameterData) procOptions.parameterData = options.parameterData
    if (options.processorOptions !== undefined) procOptions.processorOptions = options.processorOptions

    _pendingPort = this.#procPort
    try {
      this.#processor = new ProcessorClass(procOptions)
    } catch (e) {
      // Spec: constructor errors fire onprocessorerror
      queueMicrotask(() => {
        let ev = new (globalThis.ErrorEvent || Event)('processorerror', { error: e, message: e?.message })

        this.dispatchEvent(ev)
      })
      this.#processor = null
    }
    _pendingPort = null

    // create AudioParams from parameterDescriptors
    let descriptors = ProcessorClass.parameterDescriptors || []
    for (let desc of descriptors) {
      let param = new AudioParam(context, desc.defaultValue ?? 0, desc.automationRate === 'k-rate' ? 'k' : 'a', desc.minValue, desc.maxValue)
      this.#paramMap.set(desc.name, param)
    }

    // pre-allocate output buffers
    this._outBufs = outputChannelCount.map(ch =>
      new AudioBuffer(ch, BLOCK_SIZE, context.sampleRate))

    // Per spec: AudioWorkletNodes are always processed (active processing)
    // even when not connected to destination, as long as keepAlive is true.
    if (context._tailNodes) context._tailNodes.add(this)
  }

  _tick() {
    super._tick()
    let outBuf = this._outBufs[0] || null
    if (!this.#alive) {
      // dead node → output silence
      if (outBuf) for (let ch = 0; ch < outBuf.numberOfChannels; ch++) outBuf.getChannelData(ch).fill(0)
      return outBuf
    }

    // gather inputs — per spec, disconnected inputs have zero channels
    let inputs = []
    for (let i = 0; i < this.numberOfInputs; i++) {
      if (this._inputs[i].sources.length === 0) {
        inputs.push(Object.freeze([]))
      } else {
        // Check ended state BEFORE ticking, since ticking may set _ended
        // during the source's last active quantum (should still report channels)
        let sources = this._inputs[i].sources
        let allEndedBefore = sources.every(s => s.node && s.node._ended)
        let buf = this._inputs[i]._tick()
        if (allEndedBefore) {
          // All sources already ended — report zero channels per spec
          inputs.push(Object.freeze([]))
        } else {
          let chArrays = []
          for (let ch = 0; ch < buf.numberOfChannels; ch++)
            chArrays.push(buf.getChannelData(ch))
          inputs.push(Object.freeze(chArrays))
        }
      }
    }
    Object.freeze(inputs)

    // Dynamic output: resize output buffers to match computedNumberOfChannels
    if (this.#dynamicOutput && this.numberOfOutputs > 0 && this.numberOfInputs > 0) {
      let inCh = inputs[0].length || 1
      if (this._outBufs[0].numberOfChannels !== inCh)
        this._outBufs[0] = new AudioBuffer(inCh, BLOCK_SIZE, this.context.sampleRate)
    }
    outBuf = this._outBufs[0] || null

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
      outputs.push(Object.freeze(chArrays))
    }
    Object.freeze(outputs)

    // gather parameters
    let parameters = {}
    let paramError = false
    for (let [name, param] of this.#paramMap) {
      let vals = param._tick()
      // Per spec: k-rate params produce Float32Array of length 1;
      // a-rate params with constant value MAY have length 1
      let arr
      if (param.automationRate === 'k-rate') {
        arr = new Float32Array([vals[0]])
      } else if (param._input.sources.length === 0 && _isConstant(vals)) {
        arr = new Float32Array([vals[0]])
      } else {
        arr = vals
      }
      try {
        parameters[name] = arr
      } catch {
        paramError = true
      }
    }
    if (paramError) {
      this.#alive = false
      return outBuf
    }

    // call processor — spec requires reading 'process' property each call (getter support)
    if (!this.#processor) return outBuf
    let keepAlive
    try {
      let processFn = this.#processor.process
      if (typeof processFn !== 'function') {
        let e = new TypeError('process is not a function')
        let ev = new (globalThis.ErrorEvent || Event)('processorerror', { error: e, message: e.message })
        this.dispatchEvent(ev)
        this.#alive = false
        if (this.context._tailNodes) this.context._tailNodes.delete(this)
        return outBuf
      }
      keepAlive = processFn.call(this.#processor, inputs, outputs, parameters)
    } catch (e) {
      let ev = new (globalThis.ErrorEvent || Event)('processorerror', { error: e, message: e?.message })

      this.dispatchEvent(ev)
      this.#alive = false
      if (this.context._tailNodes) this.context._tailNodes.delete(this)
      return outBuf
    }
    if (!keepAlive) {
      this.#alive = false
      if (this.context._tailNodes) this.context._tailNodes.delete(this)
    }

    return outBuf
  }
}


// AudioWorklet — attached to context, provides addModule()
class AudioWorklet {
  #scope = new AudioWorkletGlobalScope()
  #context
  #loadedModules = new Set()

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

    // Per spec: same module URL loaded only once
    if (this.#loadedModules.has(moduleOrSetup)) return
    this.#loadedModules.add(moduleOrSetup)

    let code = await this.#readModule(moduleOrSetup)
    let scope = this.#scope
    let regFn = (name, cls) => scope.registerProcessor(name, cls)

    // Run processor code with AudioWorkletGlobalScope globals.
    // Per spec, currentTime/currentFrame must be live values. We pass a context
    // ref and define them as local getters using Object.defineProperties on a
    // scope object. The code is wrapped to read from this scope.
    let ctx = this.#context
    let args = {
      registerProcessor: regFn,
      AudioWorkletProcessor,
      sampleRate: ctx.sampleRate,
      currentTime: 0,
      currentFrame: 0,
      port: scope.port,
      _ctx: ctx,
    }
    // `with` is required here: the spec mandates that currentTime/currentFrame are live
    // values in the AudioWorkletGlobalScope, accessible as bare identifiers in processor
    // code. Only `with` + getter-backed scope object achieves this without polluting
    // globalThis. We strip 'use strict' because `with` is forbidden in strict mode.
    // This is safe: processor code runs in an isolated Function scope, not the module scope.
    let cleanCode = code.replace(/^(['"])use strict\1;?\s*/gm, '')
    let names = Object.keys(args)
    // Wrap with a scope proxy so currentTime/currentFrame are live
    let scopeObj = Object.create(null)
    Object.defineProperty(scopeObj, 'currentTime', { get() { return ctx.currentTime }, enumerable: true, configurable: true })
    Object.defineProperty(scopeObj, 'currentFrame', { get() { return ctx._frame }, enumerable: true, configurable: true })
    for (let k of names) {
      if (k === 'currentTime' || k === 'currentFrame' || k === '_ctx') continue
      scopeObj[k] = args[k]
    }
    new Function('_s', 'with(_s){' + cleanCode + '}')(scopeObj)
  }

  async #readModule(url) {
    // Allow custom reader (e.g. for test runners with vm sandboxes or blob URLs)
    if (this.#context._readModule) return this.#context._readModule(url)

    // data: URI — inline module code
    if (url.startsWith('data:')) {
      let comma = url.indexOf(',')
      if (comma < 0) throw new Error('Invalid data URI')
      let meta = url.slice(5, comma).toLowerCase()
      let body = url.slice(comma + 1)
      return meta.includes('base64') ? atob(body) : decodeURIComponent(body)
    }

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
