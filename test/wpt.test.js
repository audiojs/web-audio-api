import test from 'tst'
import { runTest, findTests, WPT_DIR } from './wpt-runner.js'
import { join, basename, relative } from 'node:path'
import { readdirSync } from 'node:fs'

const wptRoot = join(WPT_DIR, 'the-audio-api')

// WPT tests produce unhandled rejections/exceptions from async callbacks — suppress globally
process.on('unhandledRejection', () => {})
process.on('uncaughtException', () => {})

const subdirs = readdirSync(wptRoot, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => e.name)
  .sort()

// Some context tests check real-time stats — flaky under parallel CPU contention
const FLAKY = new Set(['the-audiocontext-interface'])

// Platform-specific skips
const isDeno = typeof Deno !== 'undefined'
const isBun = typeof Bun !== 'undefined'
const SKIP_FILES = new Set([
  // Deno vm: cross-realm __proto__ access returns null, breaking Object.keys(node.__proto__)
  ...(isDeno ? ['audioparam-nominal-range.html'] : []),
  // Bun: MessagePort callback errors bypass process.on('uncaughtException'), crashing the process.
  // These tests fail on all runtimes (active processing not implemented) but only crash Bun.
  ...(isBun ? ['active-processing.https.html'] : []),
])

for (const subdir of subdirs) {
  const opts = { timeout: 60000, ...(FLAKY.has(subdir) && { retry: 2 }) }
  test(`WPT ${subdir}`, opts, async (t) => {
    const files = findTests(join(wptRoot, subdir)).filter(f => !SKIP_FILES.has(basename(f)))
    const results = await Promise.all(files.map(f =>
      runTest(f).catch(e => ({ file: relative(WPT_DIR, f), tests: [{ name: 'runner', status: 2, message: e.message }] }))
    ))
    for (const result of results) {
      if (result.status === 'skip') continue
      const fails = result.tests.filter(r => r.status !== 0)
      t.ok(fails.length === 0,
        result.file + (fails.length
          ? '\n    ' + fails.map(r => `[${['', 'FAIL', 'ERR', 'SKIP'][r.status]}] ${r.name}: ${(r.message || '').slice(0, 100)}`).join('\n    ')
          : ''))
    }
  })
}
