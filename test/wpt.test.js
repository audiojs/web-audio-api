import test from 'tst'
import { runTest, findTests, WPT_DIR } from './wpt-runner.js'
import { join, relative } from 'node:path'
import { readdirSync } from 'node:fs'

const wptRoot = join(WPT_DIR, 'the-audio-api')

// Suppress WPT-generated unhandled rejections — reference-counted across parallel blocks
const _noop = () => {}
let _depth = 0
const _enter = () => { if (!_depth++) { process.on('unhandledRejection', _noop); process.on('uncaughtException', _noop) } }
const _exit  = () => { if (!--_depth) { process.off('unhandledRejection', _noop); process.off('uncaughtException', _noop) } }

const subdirs = readdirSync(wptRoot, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => e.name)
  .sort()

// Some context tests check real-time stats — flaky under parallel CPU contention
const FLAKY = new Set(['the-audiocontext-interface'])

for (const subdir of subdirs) {
  const opts = { timeout: 60000, ...(FLAKY.has(subdir) && { retry: 2 }) }
  test(`WPT ${subdir}`, opts, async (t) => {
    _enter()
    try {
      const files = findTests(join(wptRoot, subdir))
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
    } finally {
      _exit()
    }
  })
}
