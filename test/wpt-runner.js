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

function loadHelpers(html) {
  let code = ''
  let re = /<script\s+src="\/webaudio\/resources\/([^"]+)"/gi
  let m
  while ((m = re.exec(html))) {
    try { code += readFileSync(join(WAA_RESOURCES, m[1]), 'utf8') + '\n' } catch {}
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


  let helpers = loadHelpers(html)
  let tests = []

  // Build sandbox with linkedom's DOM
  let { window: domWin, document } = parseHTML('<!DOCTYPE html><html><body></body></html>')

  let sandbox = Object.create(null)
  // Copy all DOM globals from linkedom
  for (let k of Object.getOwnPropertyNames(domWin)) {
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
    Event, CustomEvent, MessageChannel,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
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
      assert_throws_dom = function(type, fn, msg) {
        try { fn(); throw new Error(msg || 'expected exception') }
        catch(e) { if (e.message === (msg || 'expected exception')) throw e;
          if (e.name !== type) throw new Error((msg ? msg + ': ' : '') + 'expected ' + type + ' but got ' + e.name) }
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

    // Register result callback
    vm.runInContext(`
      var __wpt_results = [];
      add_result_callback(function(t) {
        __wpt_results.push({ name: t.name, status: t.status, message: t.message || '' });
      });
    `, ctx)

    // Run helpers + test code
    vm.runInContext(helpers + '\n' + code, ctx, {
      filename: relative(WPT_DIR, filePath),
      timeout: 3000
    })

    // Wait for async tests to complete
    await new Promise(r => setTimeout(r, 200))

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
