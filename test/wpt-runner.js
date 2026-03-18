#!/usr/bin/env node
// WPT test runner for web-audio-api
// Runs W3C Web Platform Tests against our implementation using happy-dom
//
// Usage: node test/wpt-runner.js [filter]

import { readFileSync, readdirSync } from 'fs'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'
import vm from 'vm'
import { parseHTML } from 'linkedom'
import * as waa from '../index.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const WPT_DIR = join(__dirname, 'wpt/webaudio')
const RESOURCES_DIR = join(__dirname, 'wpt/resources')
const WAA_RESOURCES = join(WPT_DIR, 'resources')

process.on('unhandledRejection', () => {})
process.on('uncaughtException', () => {})

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
    if (!/<script[^>]*\ssrc=/i.test(m[0]) && m[1].trim()) scripts.push(m[1])
  }
  return scripts.join('\n')
}

function loadHelpers(html, testDir) {
  let code = ''
  let re = /<script\s+src="([^"]+\.js)"/gi
  let m
  while ((m = re.exec(html))) {
    let src = m[1]
    if (src.includes('testharness')) continue // already loaded
    // resolve relative to WPT root
    let path = src.startsWith('/') ? join(join(__dirname, 'wpt'), src.slice(1)) : join(testDir, src)
    try { code += readFileSync(path, 'utf8') + '\n' } catch {}
  }
  return code
}

// WPT-safe AudioContext — no render loop (WPT tests don't produce real audio output)
// _wptTestDir is set per-test to the directory containing the HTML file
let _wptTestDir = ''

class WPTAudioContext extends waa.AudioContext {
  constructor(opts) {
    super(opts)
    this.outStream = { write: () => true, once() {}, end() {} }
    this._basePath = _wptTestDir
  }
  _renderLoop() {}
}

class WPTOfflineAudioContext extends waa.OfflineAudioContext {
  constructor(...args) {
    super(...args)
    this._basePath = _wptTestDir
  }
}

async function runTest(filePath) {
  let html = readFileSync(filePath, 'utf8')
  let code = extractScripts(html)
  if (!code.trim()) return { file: filePath, tests: [], status: 'skip' }


  let helpers = loadHelpers(html, join(filePath, '..'))
  let tests = []

  // Build sandbox with linkedom's DOM
  let { window: domWin, document } = parseHTML('<!DOCTYPE html><html><body></body></html>')

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
  sandbox.location = { href: 'https://localhost/', protocol: 'https:', search: '', pathname: '/' }
  sandbox.navigator = { userAgent: 'node' }

  // Standard JS globals
  Object.assign(sandbox, {
    Float32Array, Float64Array, Uint8Array, Int16Array, Int32Array, Uint32Array,
    ArrayBuffer, DataView, Array, Object, Number, String, Boolean, Symbol, RegExp,
    Math, JSON, console, parseInt, parseFloat, isNaN, isFinite, NaN, Infinity, undefined,
    setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
    Promise, Proxy, Reflect, Map, Set, WeakMap, WeakSet,
    Error, TypeError, RangeError, SyntaxError, ReferenceError, URIError, DOMException,
    Event, CustomEvent, MessageChannel, WebAssembly, SharedArrayBuffer,
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

  // Web Audio API
  for (let [k, v] of Object.entries(waa)) sandbox[k] = v
  sandbox.AudioContext = WPTAudioContext
  sandbox.OfflineAudioContext = WPTOfflineAudioContext

  let ctx = vm.createContext(sandbox)

  try {
    // Run testharness.js
    vm.runInContext(testharnessCode, ctx, { filename: 'testharness.js' })

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
      assert_throws_dom = function(type, fn, msg) {
        var expected = _legacyNames[type] || type;
        try { fn(); throw new Error(msg || 'expected exception') }
        catch(e) { if (e.message === (msg || 'expected exception')) throw e;
          if (e.name !== expected) throw new Error((msg ? msg + ': ' : '') + 'expected ' + expected + ' but got ' + e.name) }
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

    // Run helpers + test code
    vm.runInContext(helpers + '\n' + code, ctx, {
      filename: relative(WPT_DIR, filePath),
      timeout: 3000
    })

    // Fire 'load' event to signal testharness that page has loaded
    vm.runInContext("dispatchEvent(new Event('load'))", ctx)

    // Wait for async tests to complete (poll for done, up to 5s)
    let deadline = Date.now() + 5000
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 50))
      try {
        let done = vm.runInContext('typeof __wpt_done !== "undefined" ? __wpt_done : __wpt_results.length > 0', ctx)
        if (done) break
      } catch { break }
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

// Main
// Skip directories that cause Node.js native crashes (heavy vm context + Audit class)
let pattern = process.argv[2] || null
let files = findTests(join(WPT_DIR, 'the-audio-api'), pattern)
console.log(`WPT web-audio: ${files.length} files${pattern ? ` (filter: ${pattern})` : ''}\n`)

let totalPass = 0, totalFail = 0, totalSkip = 0
let CONCURRENCY = parseInt(process.env.WPT_CONCURRENCY) || 8

// Run tests in parallel batches
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
      console.log(`✗ ${result.file} (${pass}/${pass + fail})`)
      if (!process.env.WPT_QUIET)
        for (let t of result.tests.filter(t => t.status !== 0))
          console.log(`    ${['PASS','FAIL','ERR','SKIP'][t.status]}: ${t.name} — ${(t.message || '').slice(0, 120)}`)
    } else if (pass) {
      console.log(`✓ ${result.file} (${pass} tests)`)
    }
  }
}

console.log(`\n─── WPT Summary ───`)
console.log(`Pass: ${totalPass}  Fail: ${totalFail}  Skip: ${totalSkip}`)
console.log(`Rate: ${totalPass + totalFail > 0 ? (100 * totalPass / (totalPass + totalFail)).toFixed(1) : 0}%`)
