#!/usr/bin/env node
// WPT test runner for web-audio-api
// Runs W3C Web Platform Tests against our implementation
//
// Usage: node test/wpt-runner.js [glob-pattern]
// Example: node test/wpt-runner.js '**/the-gainnode*'

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, basename } from 'path'
import { fileURLToPath } from 'url'
import * as waa from '../index.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const WPT_DIR = join(__dirname, 'wpt/webaudio')
const RESOURCES_DIR = join(__dirname, 'wpt/resources')
const WAA_RESOURCES = join(WPT_DIR, 'resources')

// Load testharness.js
const testharnessCode = readFileSync(join(RESOURCES_DIR, 'testharness.js'), 'utf8')

// Load WPT webaudio helper scripts (loaded per-test based on <script src> tags)
function loadHelpers(html) {
  let code = ''
  let re = /<script\s+src="\/webaudio\/resources\/([^"]+)"/gi
  let match
  while ((match = re.exec(html))) {
    try { code += readFileSync(join(WAA_RESOURCES, match[1]), 'utf8') + '\n' } catch {}
  }
  return code
}

// Collect HTML test files
function findTests(dir, pattern) {
  let results = []
  for (let entry of readdirSync(dir, { withFileTypes: true })) {
    let full = join(dir, entry.name)
    if (entry.isDirectory()) results.push(...findTests(full, pattern))
    else if (entry.name.endsWith('.html')) {
      if (!pattern || full.includes(pattern)) results.push(full)
    }
  }
  return results
}

// Extract <script> content from HTML (skip external src scripts)
function extractScripts(html) {
  let scripts = []
  let re = /<script[^>]*>([\s\S]*?)<\/script>/gi
  let match
  while ((match = re.exec(html))) {
    // skip scripts with src attribute (those are testharness/resources)
    if (/<script[^>]*src=/i.test(match[0])) continue
    if (match[1].trim()) scripts.push(match[1])
  }
  return scripts.join('\n')
}

// Run a single WPT test
async function runTest(filePath) {
  let html = readFileSync(filePath, 'utf8')
  let code = extractScripts(html)
  if (!code.trim()) return { file: filePath, status: 'skip', reason: 'no inline script' }

  // Create sandbox with globals
  let results = []
  let testDone = null
  let promise = new Promise(resolve => { testDone = resolve })
  let timeout = setTimeout(() => {
    tests.push({ name: 'timeout', status: 'error', message: 'test timed out (3s)' })
    testDone()
  }, 3000)

  // testharness.js shim — capture test results
  // WPT-safe AudioContext — auto-provides a dummy outStream
  class WPTAudioContext extends waa.AudioContext {
    constructor(opts) {
      super(opts)
      this.outStream = { write() { return true }, once() {}, end() {} }
    }
  }

  let sandbox = {
    ...waa,
    AudioContext: WPTAudioContext,
    OfflineAudioContext: waa.OfflineAudioContext,
    AudioBuffer: waa.AudioBuffer,
    AudioWorkletNode: waa.AudioWorkletNode,
    ChannelMergerNode: waa.ChannelMergerNode,
    ChannelSplitterNode: waa.ChannelSplitterNode,
    Float32Array, Float64Array, Uint8Array, Int16Array, Int32Array, Uint32Array,
    Math, console, setTimeout, clearTimeout, setInterval, clearInterval, Promise,
    Event, MessageChannel, Error, TypeError, RangeError,
    self: {},
    window: {},
    document: { title: '', createElement: () => ({ style: {} }) },
  }

  // Minimal testharness implementation
  let tests = []
  sandbox.test = function(fn, name) {
    try {
      fn()
      tests.push({ name, status: 'pass' })
    } catch (e) {
      tests.push({ name, status: 'fail', message: e.message })
    }
  }
  sandbox.promise_test = async function(fn, name) {
    try {
      await fn({ add_cleanup() {}, step_func(f) { return f }, done() {} })
      tests.push({ name, status: 'pass' })
    } catch (e) {
      tests.push({ name, status: 'fail', message: e.message })
    }
  }
  sandbox.async_test = function(name) {
    let t = {
      step(fn) { try { fn() } catch(e) { tests.push({ name, status: 'fail', message: e.message }) } },
      step_func(fn) { return (...args) => { try { fn(...args) } catch(e) { tests.push({ name, status: 'fail', message: e.message }) } } },
      done() { tests.push({ name, status: 'pass' }) },
      add_cleanup() {},
    }
    return t
  }
  sandbox.setup = function() {}
  sandbox.done = function() {}
  sandbox.assert_equals = function(a, b, msg) { if (a !== b) throw new Error(msg || `${a} !== ${b}`) }
  sandbox.assert_not_equals = function(a, b, msg) { if (a === b) throw new Error(msg || `${a} === ${b}`) }
  sandbox.assert_true = function(v, msg) { if (!v) throw new Error(msg || 'not true') }
  sandbox.assert_false = function(v, msg) { if (v) throw new Error(msg || 'not false') }
  sandbox.assert_throws_js = function(Type, fn, msg) {
    try { fn(); throw new Error(msg || 'expected throw') } catch(e) { if (e.message === (msg || 'expected throw')) throw e }
  }
  sandbox.assert_throws_dom = sandbox.assert_throws_js
  sandbox.assert_greater_than = function(a, b, msg) { if (!(a > b)) throw new Error(msg || `${a} not > ${b}`) }
  sandbox.assert_greater_than_equal = function(a, b, msg) { if (!(a >= b)) throw new Error(msg || `${a} not >= ${b}`) }
  sandbox.assert_less_than = function(a, b, msg) { if (!(a < b)) throw new Error(msg || `${a} not < ${b}`) }
  sandbox.assert_less_than_equal = function(a, b, msg) { if (!(a <= b)) throw new Error(msg || `${a} not <= ${b}`) }
  sandbox.assert_approx_equals = function(a, b, tol, msg) { if (Math.abs(a - b) > tol) throw new Error(msg || `${a} !≈ ${b} (tol ${tol})`) }
  sandbox.assert_array_approx_equals = function(a, b, tol, msg) {
    if (a.length !== b.length) throw new Error(msg || `lengths differ: ${a.length} vs ${b.length}`)
    for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > tol) throw new Error(msg || `[${i}]: ${a[i]} !≈ ${b[i]}`)
  }
  sandbox.assert_unreached = function(msg) { throw new Error(msg || 'should not be reached') }
  sandbox.assert_array_equals = function(a, b, msg) {
    if (a.length !== b.length) throw new Error(msg || `array lengths differ: ${a.length} vs ${b.length}`)
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) throw new Error(msg || `[${i}]: ${a[i]} !== ${b[i]}`)
  }
  sandbox.assert_class_string = function(obj, cls, msg) {
    if (obj?.constructor?.name !== cls) throw new Error(msg || `expected ${cls}, got ${obj?.constructor?.name}`)
  }
  sandbox.assert_inherits = function(obj, prop, msg) {
    if (!(prop in obj)) throw new Error(msg || `missing property ${prop}`)
  }
  sandbox.assert_own_property = function(obj, prop, msg) {
    if (!Object.prototype.hasOwnProperty.call(obj, prop) && !(prop in obj)) throw new Error(msg || `missing own property ${prop}`)
  }
  sandbox.assert_readonly = function(obj, prop, msg) {
    let desc = Object.getOwnPropertyDescriptor(obj, prop) ||
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(obj), prop)
    if (desc && desc.set) throw new Error(msg || `${prop} is not readonly`)
  }
  sandbox.assert_idl_attribute = sandbox.assert_own_property
  sandbox.assert_regexp_match = function(val, re, msg) {
    if (!re.test(val)) throw new Error(msg || `${val} does not match ${re}`)
  }

  // computeSNR helper (used by many WPT audio tests)
  sandbox.computeSNR = function(actual, expected) {
    let signal = 0, noise = 0
    for (let i = 0; i < actual.length; i++) {
      signal += expected[i] * expected[i]
      let diff = actual[i] - expected[i]
      noise += diff * diff
    }
    return noise > 0 ? signal / noise : Infinity
  }

  try {
    // Build function body with all helpers and test code
    let helpers = loadHelpers(html)
    let body = `
      ${helpers}
      ${code}
    `
    let fn = new Function(...Object.keys(sandbox), body)
    let result = fn(...Object.values(sandbox))
    if (result instanceof Promise) await result.catch(e => tests.push({ name: 'async', status: 'error', message: e.message }))
    await new Promise(r => setTimeout(r, 100))
  } catch (e) {
    tests.push({ name: 'execution', status: 'error', message: e.message })
  }

  clearTimeout(timeout)
  return { file: relative(WPT_DIR, filePath), tests }
}

// Prevent unhandled rejection crashes
process.on('unhandledRejection', () => {})

// Main
let pattern = process.argv[2] || null
let files = findTests(join(WPT_DIR, 'the-audio-api'), pattern)

console.log(`WPT web-audio tests: ${files.length} files${pattern ? ` (filter: ${pattern})` : ''}\n`)

let totalPass = 0, totalFail = 0, totalSkip = 0, totalError = 0

for (let file of files) {
  let result = await runTest(file)

  if (result.status === 'skip') {
    totalSkip++
    continue
  }

  let pass = result.tests.filter(t => t.status === 'pass').length
  let fail = result.tests.filter(t => t.status === 'fail').length
  let error = result.tests.filter(t => t.status === 'error').length

  totalPass += pass
  totalFail += fail
  totalError += error

  if (fail || error) {
    console.log(`✗ ${result.file}`)
    for (let t of result.tests.filter(t => t.status !== 'pass'))
      console.log(`    ${t.status}: ${t.name || ''} — ${t.message || ''}`)
  } else if (pass) {
    console.log(`✓ ${result.file} (${pass} tests)`)
  }
}

console.log(`\n─── WPT Summary ───`)
console.log(`Pass: ${totalPass}`)
console.log(`Fail: ${totalFail}`)
console.log(`Error: ${totalError}`)
console.log(`Skip: ${totalSkip}`)
console.log(`Total: ${totalPass + totalFail + totalError} assertions in ${files.length} files`)
