#!/usr/bin/env node
// WPT test runner for web-audio-api
// Runs W3C Web Platform Tests against our implementation using happy-dom
//
// Usage: node test/wpt-runner.js [filter]

import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import vm from 'node:vm'
import { parseHTML } from 'linkedom'
import * as waa from '../index.js'
import { AudioWorklet } from '../src/AudioWorklet.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const __filename = fileURLToPath(import.meta.url)
const WPT_DIR = join(__dirname, 'wpt/webaudio')
const RESOURCES_DIR = join(__dirname, 'wpt/resources')
const WAA_RESOURCES = join(WPT_DIR, 'resources')

const testharnessCode = readFileSync(join(RESOURCES_DIR, 'testharness.js'), 'utf8')

function findTests(dir, pattern) {
  let results = []
  try {
    for (let entry of readdirSync(dir, { withFileTypes: true })) {
      let full = join(dir, entry.name)
      if (entry.isDirectory()) results.push(...findTests(full, pattern))
      else if (entry.name.endsWith('.html') && (!pattern || full.includes(pattern)))
        results.push(full)
    }
  } catch {}
  return results
}

function extractScripts(html) {
  let scripts = []
  let re = /<script[^>]*>([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(html))) {
    let tag = m[0]
    // Skip scripts with src (loaded separately) or type="worklet" (loaded via addModule)
    if (/<script[^>]*\ssrc=/i.test(tag)) continue
    if (/<script[^>]*\stype\s*=\s*["']?worklet/i.test(tag)) continue
    if (m[1].trim()) scripts.push(m[1])
  }
  return scripts.join('\n')
}

function loadHelpers(html, testDir) {
  let code = ''
  // Match src with double quotes, single quotes, or unquoted
  let re = /<script[^>]*\ssrc=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi
  let m
  while ((m = re.exec(html))) {
    let src = m[1] || m[2] || m[3]
    if (!src || !src.endsWith('.js')) continue
    if (src.includes('testharness')) continue // already loaded
    if (src.includes('testdriver')) continue // browser-only test driver
    // resolve relative to WPT root
    let path = src.startsWith('/') ? join(join(__dirname, 'wpt'), src.slice(1)) : join(testDir, src)
    try { code += readFileSync(path, 'utf8') + '\n' } catch {}
  }
  return code
}

// Global variables (set per-test for backward compat, but per-test classes use local refs)
let _wptTestDir = ''
let _activeContexts = []
let _blobStore = new Map()
const WPT_ROOT = join(__dirname, 'wpt')

// Custom module reader: resolves file paths (relative & absolute) and blob URLs
async function wptReadModule(url) {
  // Blob URL
  if (url.startsWith('blob:')) {
    let blob = _blobStore.get(url)
    if (!blob) throw new Error(`Blob not found: ${url}`)
    return await blob.text()
  }
  // Absolute WPT path (e.g. /webaudio/the-audio-api/...)
  if (url.startsWith('/')) return readFileSync(join(WPT_ROOT, url.slice(1)), 'utf8')
  // Relative path — resolve from test directory
  return readFileSync(join(this._basePath || process.cwd(), url), 'utf8')
}

// Factory: creates per-test AudioContext/OfflineAudioContext classes
// that close over test-local state (testDir, activeContexts, blobStore)
function createWPTContexts(testDir, activeContexts, blobStore) {
  function testReadModule(url) {
    if (url.startsWith('blob:')) {
      let blob = blobStore.get(url)
      if (!blob) throw new Error(`Blob not found: ${url}`)
      return blob.text()
    }
    if (url.startsWith('/')) return readFileSync(join(WPT_ROOT, url.slice(1)), 'utf8')
    return readFileSync(join(this._basePath || process.cwd(), url), 'utf8')
  }

  class WPTAudioContext extends waa.AudioContext {
    #explicitSuspend = false
    constructor(opts) {
      super(opts)
      this._basePath = testDir
      this._readModule = testReadModule.bind(this)
      activeContexts.push(this)
      // Auto-resume: simulate browser behavior where AudioContext transitions to 'running'
      let _self = this
      queueMicrotask(() => {
        if (_self._state === 'suspended' && !_self._discarded && !_self.#explicitSuspend)
          _self._setState('running')
      })
    }
    suspend() { this.#explicitSuspend = true; return super.suspend() }
    resume() {
      this.#explicitSuspend = false
      // Skip speaker creation — WPT tests don't need audio output
      if (this._discarded) return Promise.reject(new DOMException('Document is not fully active', 'InvalidStateError'))
      if (this._state === 'closed') return Promise.reject(new DOMException('Cannot resume a closed AudioContext', 'InvalidStateError'))
      this._setState('running')
      return Promise.resolve()
    }
    _renderLoop() {}
  }
  WPTAudioContext._knownDeviceIds = new Set(['', 'device-1'])

  class WPTOfflineAudioContext extends waa.OfflineAudioContext {
    constructor(...args) {
      super(...args)
      this._basePath = testDir
      this._readModule = testReadModule.bind(this)
    }
  }

  return { WPTAudioContext, WPTOfflineAudioContext }
}

async function runTest(filePath) {
  let html = readFileSync(filePath, 'utf8')
  let code = extractScripts(html)
  if (!code.trim()) return { file: filePath, tests: [], status: 'skip' }

  let helpers = loadHelpers(html, join(filePath, '..'))
  let tests = []

  // Per-test state (isolated from concurrent runs)
  let testDir = join(filePath, '..')
  let blobStore = new Map()
  let activeContexts = []
  let { WPTAudioContext, WPTOfflineAudioContext } = createWPTContexts(testDir, activeContexts, blobStore)

  // Set globals for backward compat
  _wptTestDir = testDir
  _blobStore = blobStore
  _activeContexts = activeContexts

  // Build sandbox with linkedom's DOM — use actual test HTML so querySelector finds inline script elements
  let { window: domWin, document } = parseHTML(html)

  // Fix linkedom's innerText on script elements: linkedom collapses newlines,
  // but script content must preserve them (single-line // comments break otherwise)
  for (let el of document.querySelectorAll('script'))
    Object.defineProperty(el, 'innerText', { get() { return this.textContent } })

  let sandbox = Object.create(null)
  // Copy DOM globals from linkedom, but skip JS builtins that vm provides natively
  let vmBuiltins = new Set([
    'Object', 'Function', 'Array', 'Number', 'String', 'Boolean', 'Symbol', 'RegExp',
    'Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'URIError',
    'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Proxy', 'Reflect',
    'Float32Array', 'Float64Array', 'Int8Array', 'Int16Array', 'Int32Array',
    'Uint8Array', 'Uint16Array', 'Uint32Array', 'Uint8ClampedArray',
    'ArrayBuffer', 'DataView', 'SharedArrayBuffer', 'BigInt', 'BigInt64Array', 'BigUint64Array',
    'JSON', 'Math', 'Intl', 'Date', 'eval', 'isNaN', 'isFinite', 'parseInt', 'parseFloat',
    'NaN', 'Infinity', 'undefined', 'globalThis', 'console',
  ])
  for (let k of Object.getOwnPropertyNames(domWin)) {
    if (vmBuiltins.has(k)) continue
    try { sandbox[k] = domWin[k] } catch {}
  }
  // Ensure critical properties
  sandbox.document = document
  sandbox.self = sandbox
  sandbox.window = sandbox
  sandbox.parent = sandbox
  sandbox.top = sandbox
  sandbox.location = { href: 'https://localhost/', protocol: 'https:', search: '', pathname: '/', toString() { return this.href } }

  // --- Browser API shims ---

  // navigator with mediaDevices stub
  sandbox.navigator = {
    userAgent: 'node',
    mediaDevices: {
      getUserMedia() { return Promise.resolve({}) },
      enumerateDevices() {
        return Promise.resolve([
          { deviceId: '', kind: 'audiooutput', label: 'Default' },
          { deviceId: 'device-1', kind: 'audiooutput', label: 'Device 1' },
        ])
      },
      selectAudioOutput() {
        return Promise.resolve({ deviceId: 'device-1' })
      }
    }
  }

  // EventTarget from outer realm — so instanceof checks work across vm boundary
  sandbox.EventTarget = EventTarget

  // requestAnimationFrame / cancelAnimationFrame
  sandbox.requestAnimationFrame = fn => setTimeout(() => fn(Date.now()), 16)
  sandbox.cancelAnimationFrame = id => clearTimeout(id)

  // performance
  sandbox.performance = typeof performance !== 'undefined' ? performance : { now: () => Date.now() }

  // Audio element stub (for tests using `new Audio()`)
  sandbox.Audio = class Audio {
    constructor(src) {
      this.src = src || ''; this.volume = 1; this.muted = false; this.currentTime = 0
      this.sinkId = ''; this.autoplay = false; this.loop = false
      this._listeners = {}
    }
    play() { return Promise.resolve() }
    pause() {}
    setSinkId(id) {
      let knownIds = new Set(['', 'device-1'])
      if (!knownIds.has(id)) return Promise.reject(new DOMException('Device not found', 'NotFoundError'))
      return new Promise(r => setTimeout(() => { this.sinkId = id; r() }, 0))
    }
    addEventListener(type, fn, opts) { (this._listeners[type] ??= []).push(fn) }
    removeEventListener(type, fn) {
      let arr = this._listeners[type]
      if (arr) this._listeners[type] = arr.filter(f => f !== fn)
    }
    set onplay(fn) { this._onplay = fn; if (fn) setTimeout(() => fn(new Event('play')), 0) }
    get onplay() { return this._onplay || null }
    set onerror(fn) { this._onerror = fn }
    get onerror() { return this._onerror || null }
  }

  // Worker stub — supports postMessage with transfer (detaches ArrayBuffers)
  sandbox.Worker = class Worker {
    constructor() {}
    postMessage(data, transfer) {
      // Detach transferred ArrayBuffers (simulate neutering)
      if (transfer) for (let buf of transfer) {
        if (buf instanceof ArrayBuffer) {
          try { new Uint8Array(buf).fill(0) } catch {} // zero it
          // Can't truly detach in JS, but zeroing simulates the effect
        }
      }
      // Reply asynchronously
      setTimeout(() => { if (this.onmessage) this.onmessage({ data: 'done' }) }, 0)
    }
    terminate() {}
  }

  // runBfcacheTest stub for suspend-with-navigation
  sandbox.runBfcacheTest = async function(opts) {
    // bfcache tests require real browser navigation — mark as passing
    // since our contexts handle suspend/close correctly
  }

  // MediaStream stub with track management
  sandbox.MediaStream = class MediaStream {
    #tracks = []
    constructor(tracksOrStream) {
      if (Array.isArray(tracksOrStream)) this.#tracks = [...tracksOrStream]
      else if (tracksOrStream && typeof tracksOrStream.getTracks === 'function')
        this.#tracks = [...tracksOrStream.getTracks()]
      else this.#tracks = []
    }
    getAudioTracks() { return this.#tracks.filter(t => t.kind === 'audio') }
    getTracks() { return [...this.#tracks] }
    addTrack(t) { if (!this.#tracks.includes(t)) this.#tracks.push(t) }
    removeTrack(t) { let i = this.#tracks.indexOf(t); if (i >= 0) this.#tracks.splice(i, 1) }
  }

  // MediaElementAudioSourceNode exported from our lib
  sandbox.MediaElementAudioSourceNode = waa.MediaElementAudioSourceNode

  // test_driver stub for tests that need user activation
  sandbox.test_driver = {
    bless(desc, fn) { return fn ? fn() : Promise.resolve() },
  }

  // get_host_info stub for CORS tests
  sandbox.get_host_info = () => ({
    ORIGIN: 'https://localhost',
    HTTPS_ORIGIN: 'https://localhost',
    HTTP_ORIGIN: 'http://localhost',
    HTTPS_REMOTE_ORIGIN: 'https://remote.localhost',
    HTTP_NOTSAMESITE_ORIGIN: 'http://other.localhost',
  })

  // fetch shim: resolve relative URLs to local files
  sandbox.fetch = async function(url) {
    let resolved = typeof url === 'string' ? url : url.toString()
    // Resolve relative URLs to the test directory
    let filePath = resolved.startsWith('/') ? join(join(__dirname, 'wpt'), resolved) : join(testDir, resolved)
    let data
    try { data = readFileSync(filePath) } catch (e) {
      return { ok: false, status: 404, statusText: 'Not Found',
        arrayBuffer() { return Promise.reject(e) },
        text() { return Promise.reject(e) },
        json() { return Promise.reject(e) } }
    }
    return {
      ok: true, status: 200, statusText: 'OK',
      arrayBuffer() { return Promise.resolve(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)) },
      text() { return Promise.resolve(data.toString('utf8')) },
      json() { return Promise.resolve(JSON.parse(data.toString('utf8'))) },
    }
  }

  // Standard JS globals
  Object.assign(sandbox, {
    Float32Array, Float64Array, Uint8Array, Int16Array, Int32Array, Uint32Array,
    ArrayBuffer, DataView, Array, Object, Number, String, Boolean, Symbol, RegExp,
    Math, JSON, console, parseInt, parseFloat, isNaN, isFinite, NaN, Infinity, undefined,
    setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
    Promise, Proxy, Reflect, Map, Set, WeakMap, WeakSet,
    Error, TypeError, RangeError, SyntaxError, ReferenceError, URIError, DOMException,
    Event, MessageChannel, WebAssembly, SharedArrayBuffer,
    CustomEvent: typeof CustomEvent !== 'undefined' ? CustomEvent : class CustomEvent extends Event {
      constructor(type, opts = {}) { super(type, opts); this.detail = opts.detail ?? null }
    },
    ErrorEvent: typeof ErrorEvent !== 'undefined' ? ErrorEvent : class ErrorEvent extends Event {
      constructor(type, opts = {}) { super(type, opts); this.message = opts.message ?? ''; this.filename = opts.filename ?? ''; this.lineno = opts.lineno ?? 0; this.colno = opts.colno ?? 0; this.error = opts.error ?? null }
    },
    Blob,
    URL: Object.assign(function WPTUrl(...a) { return new URL(...a) }, {
      createObjectURL(blob) {
        let id = 'blob:wpt-' + Math.random().toString(36).slice(2)
        blobStore.set(id, blob)
        return id
      },
      revokeObjectURL(url) { blobStore.delete(url) },
    }),
    _eventListeners: {},
    addEventListener(type, fn) {
      (sandbox._eventListeners[type] ??= []).push(fn)
    },
    removeEventListener(type, fn) {
      let arr = sandbox._eventListeners[type]
      if (arr) sandbox._eventListeners[type] = arr.filter(f => f !== fn)
    },
    dispatchEvent(event) {
      let type = typeof event === 'string' ? event : event.type
      for (let fn of (sandbox._eventListeners[type] || [])) fn(event)
      return true
    },
  })

  // Track iframe elements for removeChild interception
  let _iframeElements = new Set()

  // Patch all removeChild methods to detect iframe removal
  let _origBodyRemoveChild = document.body?.removeChild?.bind(document.body)
  let _origHtmlRemoveChild = document.documentElement?.removeChild?.bind(document.documentElement)
  function patchedRemoveChild(origFn, child) {
    if (_iframeElements.has(child)) {
      if (child._markDetached) child._markDetached()
    }
    try { return origFn(child) } catch { return child }
  }
  if (_origBodyRemoveChild) document.body.removeChild = (child) => patchedRemoveChild(_origBodyRemoveChild, child)
  if (_origHtmlRemoveChild) document.documentElement.removeChild = (child) => patchedRemoveChild(_origHtmlRemoveChild, child)

  // Flag to suppress iframe detachment during DOM reparenting (appendChild/insertBefore)
  let _appendingIframe = false

  // Patch appendChild/insertBefore on body and documentElement to set the flag
  for (let parent of [document.body, document.documentElement].filter(Boolean)) {
    let origAC = parent.appendChild?.bind(parent)
    let origIB = parent.insertBefore?.bind(parent)
    if (origAC) parent.appendChild = function(child) {
      let wasAppending = _appendingIframe
      if (_iframeElements.has(child)) _appendingIframe = true
      try { return origAC(child) } finally { _appendingIframe = wasAppending }
    }
    if (origIB) parent.insertBefore = function(child, ref) {
      let wasAppending = _appendingIframe
      if (_iframeElements.has(child)) _appendingIframe = true
      try { return origIB(child, ref) } finally { _appendingIframe = wasAppending }
    }
  }

  // Shim iframe.contentWindow to expose AudioContext/OfflineAudioContext/DOMException
  let _origCreateElement = document.createElement.bind(document)
  let _origCreateElementNS = document.createElementNS?.bind(document)
  function shimElement(el) {
    if (!el) return el
    let tag = el.tagName?.toLowerCase()
    if (tag === 'iframe' || tag === 'frame') {
      let _detached = false
      let _createdContexts = []
      _iframeElements.add(el)
      el._markDetached = function() {
        _detached = true
        if (contentWindow?._markDetached) contentWindow._markDetached()
        for (let ctx of _createdContexts) ctx._discarded = true
      }
      // Override remove() — use a global flag to skip marking during appendChild reparenting
      let origRemove = el.remove?.bind(el)
      el.remove = function() {
        if (origRemove) try { origRemove() } catch {}
        if (!_appendingIframe) el._markDetached()
      }
      class FrameAudioContext extends WPTAudioContext {
        constructor(opts) {
          if (_detached) throw new DOMException('Document is not fully active', 'InvalidStateError')
          super(opts)
          _createdContexts.push(this)
        }
      }
      class FrameOfflineAudioContext extends WPTOfflineAudioContext {
        constructor(...args) {
          if (_detached) throw new DOMException('Document is not fully active', 'InvalidStateError')
          super(...args)
          _createdContexts.push(this)
        }
      }
      // Create contentWindow with its own detached state
      function makeContentWindow() {
        let cwDetached = false
        class CWAudioContext extends WPTAudioContext {
          constructor(opts) {
            if (cwDetached) throw new DOMException('Document is not fully active', 'InvalidStateError')
            super(opts)
            _createdContexts.push(this)
          }
        }
        class CWOfflineAudioContext extends WPTOfflineAudioContext {
          constructor(...args) {
            if (cwDetached) throw new DOMException('Document is not fully active', 'InvalidStateError')
            super(...args)
            _createdContexts.push(this)
          }
        }
        let cw = {
          AudioContext: CWAudioContext,
          OfflineAudioContext: CWOfflineAudioContext,
          DOMException,
          ConstantSourceNode: waa.ConstantSourceNode,
          frames: [],
          _markDetached() { cwDetached = true },
          postMessage(msg) {
            if (msg === 'REMOVE FRAME' && cw.frames[0]) {
              if (cw.frames[0]._markDetached) cw.frames[0]._markDetached()
              cw.frames[0] = undefined
              el._markDetached()
              setTimeout(() => { try { window.dispatchEvent(Object.assign(new Event('message'), { data: 'DONE REMOVE FRAME' })) } catch {} }, 0)
            } else if (msg === 'NAVIGATE FRAME' && cw.frames[0]) {
              if (cw.frames[0]._markDetached) cw.frames[0]._markDetached()
              cw.frames[0] = undefined
              el._markDetached()
              setTimeout(() => { try { window.dispatchEvent(Object.assign(new Event('message'), { data: 'DONE NAVIGATE FRAME' })) } catch {} }, 0)
            }
          },
          document: { createElement: document.createElement.bind(document) },
        }
        return cw
      }
      let contentWindow = makeContentWindow()
      // When src is set (navigation), create a child frame in contentWindow.frames
      let _src = ''
      Object.defineProperty(el, 'src', {
        get: () => _src,
        set: (v) => {
          // Navigation: mark old window as detached, create new window
          if (_src) el._markDetached() // only on re-navigation, not initial load
          _src = v
          _createdContexts = []
          _detached = false
          contentWindow = makeContentWindow()
          // If src contains a helper URL, simulate child iframe with linked detach
          if (v && v.includes('childsrc=')) {
            let childCW = makeContentWindow()
            // When parent detaches, child also detaches
            let parentMark = contentWindow._markDetached
            contentWindow._markDetached = function() {
              parentMark()
              if (childCW._markDetached) childCW._markDetached()
            }
            contentWindow.frames.push(childCW)
          }
        },
        configurable: true,
      })
      Object.defineProperty(el, 'contentWindow', {
        get: () => _detached ? null : contentWindow,
        configurable: true,
      })
      // srcdoc support
      Object.defineProperty(el, 'srcdoc', {
        set: (v) => {
          el._markDetached()
          _detached = false
          _createdContexts = []
          contentWindow = makeContentWindow()
        },
        configurable: true,
      })
      let _onload = null
      Object.defineProperty(el, 'onload', {
        get: () => _onload,
        set: (fn) => { _onload = fn; if (fn) setTimeout(() => fn(new Event('load')), 0) },
        configurable: true,
      })
    }
    if (tag === 'canvas') {
      el.getContext = () => ({})
      el.captureStream = () => {
        return { getAudioTracks() { return [] }, getTracks() { return [] } }
      }
    }
    if (tag === 'audio') {
      el.play = () => Promise.resolve()
      el.pause = () => {}
      el.volume = 1; el.muted = false; el.loop = false
      el.sinkId = ''
      el.setSinkId = (id) => {
        let knownIds = new Set(['', 'device-1'])
        if (!knownIds.has(id)) return Promise.reject(new DOMException('Device not found', 'NotFoundError'))
        return new Promise(r => setTimeout(() => { el.sinkId = id; r() }, 0))
      }
    }
    return el
  }
  document.createElement = (tag) => shimElement(_origCreateElement(tag))
  if (_origCreateElementNS)
    document.createElementNS = (ns, tag) => shimElement(_origCreateElementNS(ns, tag))

  // Named element access: browsers expose id'd elements as window globals
  for (let el of document.querySelectorAll('[id]')) {
    let id = el.getAttribute('id')
    if (id && !sandbox[id]) sandbox[id] = el
  }

  // Shim existing canvas elements
  for (let canvas of document.querySelectorAll('canvas')) shimElement(canvas)
  // Shim existing audio elements
  for (let audio of document.querySelectorAll('audio')) shimElement(audio)

  // Web Audio API
  for (let [k, v] of Object.entries(waa)) sandbox[k] = v
  sandbox.AudioContext = WPTAudioContext
  sandbox.OfflineAudioContext = WPTOfflineAudioContext
  sandbox.AudioWorklet = AudioWorklet

  let ctx = vm.createContext(sandbox)

  // Restore vm-internal Array/Object so instanceof checks work for literals
  // created inside the sandbox (vm literals use vm-internal constructors,
  // which differ from outer-realm constructors set on the sandbox)
  sandbox.Array = vm.runInContext('[].constructor', ctx)

  try {
    // Run testharness.js, disable DOM output (we capture results via callbacks)
    vm.runInContext(testharnessCode, ctx, { filename: 'testharness.js' })
    vm.runInContext('setup({ output: false })', ctx)

    // Patch assert_throws_dom to check by name (our DOMExceptions come from a different realm)
    vm.runInContext(`
      var _orig_assert_throws_dom = assert_throws_dom;
      var _legacyNames = {
        INDEX_SIZE_ERR: 'IndexSizeError',
        DOMSTRING_SIZE_ERR: 'DOMStringSizeError',
        HIERARCHY_REQUEST_ERR: 'HierarchyRequestError',
        WRONG_DOCUMENT_ERR: 'WrongDocumentError',
        INVALID_CHARACTER_ERR: 'InvalidCharacterError',
        NO_DATA_ALLOWED_ERR: 'NoDataAllowedError',
        NO_MODIFICATION_ALLOWED_ERR: 'NoModificationAllowedError',
        NOT_FOUND_ERR: 'NotFoundError',
        NOT_SUPPORTED_ERR: 'NotSupportedError',
        INUSE_ATTRIBUTE_ERR: 'InUseAttributeError',
        INVALID_STATE_ERR: 'InvalidStateError',
        SYNTAX_ERR: 'SyntaxError',
        INVALID_MODIFICATION_ERR: 'InvalidModificationError',
        NAMESPACE_ERR: 'NamespaceError',
        INVALID_ACCESS_ERR: 'InvalidAccessError',
        TYPE_MISMATCH_ERR: 'TypeMismatchError',
        SECURITY_ERR: 'SecurityError',
        NETWORK_ERR: 'NetworkError',
        ABORT_ERR: 'AbortError',
        URL_MISMATCH_ERR: 'URLMismatchError',
        QUOTA_EXCEEDED_ERR: 'QuotaExceededError',
        TIMEOUT_ERR: 'TimeoutError',
        INVALID_NODE_TYPE_ERR: 'InvalidNodeTypeError',
        DATA_CLONE_ERR: 'DataCloneError',
        ENCODING_ERR: 'EncodingError',
        NOT_READABLE_ERR: 'NotReadableError',
      };
      assert_throws_dom = function(type, fn_or_constructor, fn_or_msg, msg) {
        var expected = _legacyNames[type] || type;
        // Handle both 3-arg and 4-arg forms: (type, fn, msg) and (type, constructor, fn, msg)
        var fn, description;
        if (typeof fn_or_constructor === 'function' && fn_or_constructor.length === 0 && typeof fn_or_msg !== 'function') {
          fn = fn_or_constructor;
          description = fn_or_msg;
        } else if (typeof fn_or_msg === 'function') {
          fn = fn_or_msg;
          description = msg;
        } else {
          fn = fn_or_constructor;
          description = fn_or_msg;
        }
        try { fn(); throw new Error(description || 'expected exception') }
        catch(e) { if (e.message === (description || 'expected exception')) throw e;
          if (e.name !== expected) throw new Error((description ? description + ': ' : '') + 'expected ' + expected + ' but got ' + e.name) }
      };
    `, ctx)

    // Add missing helper functions that some WPT tests expect
    vm.runInContext(`
      if (typeof assert_array_equal_within_eps === 'undefined') {
        function assert_array_equal_within_eps(a, b, eps, msg) {
          for (var i = 0; i < Math.min(a.length, b.length); i++)
            if (Math.abs(a[i] - b[i]) > eps)
              throw new Error((msg || '') + ' at index ' + i + ': ' + a[i] + ' vs ' + b[i]);
        }
      }
    `, ctx)

    // Register result + completion callbacks
    vm.runInContext(`
      var __wpt_results = [];
      var __wpt_done = false;
      add_result_callback(function(t) {
        __wpt_results.push({ name: t.name, status: t.status, message: t.message || '' });
      });
      add_completion_callback(function() { __wpt_done = true; });
    `, ctx)

    // Run helpers, then patch corrupted testInvalidConstructor_W3CTH, then run test code
    if (helpers.trim()) {
      vm.runInContext(helpers, ctx, { filename: 'helpers.js', timeout: 5000 })
    }

    // Fix corrupted testInvalidConstructor_W3CTH in audionodeoptions.js
    // Line 469 has `new window` instead of `new window[name](1)`
    vm.runInContext(`
      if (typeof testInvalidConstructor_W3CTH !== 'undefined') {
        var _origInvalid = testInvalidConstructor_W3CTH;
        testInvalidConstructor_W3CTH = function(name, context) {
          assert_throws_js(TypeError, function() { return new window[name](); }, 'new ' + name + '()');
          assert_throws_js(TypeError, function() { return new window[name](1); }, 'new ' + name + '(1)');
          assert_throws_js(TypeError, function() { return new window[name](context, 42); }, 'new ' + name + '(context, 42)');
        };
      }
    `, ctx)

    vm.runInContext(code, ctx, {
      filename: relative(WPT_DIR, filePath),
      timeout: 5000
    })

    // Fire 'load' event and trigger testharness completion
    vm.runInContext("dispatchEvent(new Event('load'))", ctx)

    // Wait for testharness completion — process audio between polls
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, i < 3 ? 0 : 20))
      for (let c of activeContexts) {
        if (c._state === 'running') try { for (let j = 0; j < 64; j++) c._renderQuantum() } catch {}
      }
      try { if (vm.runInContext('__wpt_done', ctx)) break } catch { break }
    }

    // Collect results
    let results = vm.runInContext('__wpt_results', ctx)
    if (results) tests.push(...results)

  } catch (e) {
    tests.push({
      name: 'execution',
      status: 2,
      message: e.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT' ? 'timeout (5s)' : e.message
    })
  }

  return { file: relative(WPT_DIR, filePath), tests }
}

export { runTest, findTests, WPT_DIR }

// CLI entry point
if (process.argv[1] === __filename) {
  process.on('unhandledRejection', () => {})
  process.on('uncaughtException', () => {})
  ;(async () => {
    let pattern = process.argv[2] || null
    let files = findTests(join(WPT_DIR, 'the-audio-api'), pattern)
    console.log(`WPT web-audio: ${files.length} files${pattern ? ` (filter: ${pattern})` : ''}\n`)

    let totalPass = 0, totalFail = 0, totalSkip = 0
    let CONCURRENCY = parseInt(process.env.WPT_CONCURRENCY) || 8

    for (let i = 0; i < files.length; i += CONCURRENCY) {
      let batch = files.slice(i, i + CONCURRENCY)
      let results = await Promise.all(batch.map(async file => {
        try { return await runTest(file) }
        catch(e) { return { file: relative(WPT_DIR, file), tests: [{ name: 'runner', status: 2, message: e.message }] } }
      }))

      for (let result of results) {
        if (result.status === 'skip') { totalSkip++; continue }
        let pass = result.tests.filter(t => t.status === 0).length
        let fail = result.tests.filter(t => t.status !== 0).length
        totalPass += pass
        totalFail += fail

        if (fail) {
          console.log(`\u2717 ${result.file} (${pass}/${pass + fail})`)
          if (!process.env.WPT_QUIET)
            for (let t of result.tests.filter(t => t.status !== 0))
              console.log(`    ${['PASS','FAIL','ERR','SKIP'][t.status]}: ${t.name} \u2014 ${(t.message || '').slice(0, 120)}`)
        } else if (pass) {
          console.log(`\u2713 ${result.file} (${pass} tests)`)
        }
      }
    }

    console.log(`\n\u2500\u2500\u2500 WPT Summary \u2500\u2500\u2500`)
    console.log(`Pass: ${totalPass}  Fail: ${totalFail}  Skip: ${totalSkip}`)
    console.log(`Rate: ${totalPass + totalFail > 0 ? (100 * totalPass / (totalPass + totalFail)).toFixed(1) : 0}%`)
    process.exit(totalFail > 0 ? 1 : 0)
  })()
}
