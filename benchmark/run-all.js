// Combined benchmark: web-audio-api (JS) + node-web-audio-api (Rust) + Browser native
// Usage: node benchmark/run-all.js
// Requires playwright: npm install playwright  (or installs globally via homebrew)
import { OfflineAudioContext } from '../index.js'
import { scenarios, SR, LENGTH } from './scenarios.js'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const __dir = dirname(fileURLToPath(import.meta.url))

// ── Node.js implementations ──────────────────────────────────────────────────

const impls = [{ name: 'web-audio-api (JS)', OAC: OfflineAudioContext }]

try {
  const { OfflineAudioContext: RustOAC } = await import('node-web-audio-api')
  impls.push({ name: 'node-waa (Rust)', OAC: RustOAC })
} catch {}

async function bench(OAC, { channels, setup }) {
  const ctx = new OAC(channels, LENGTH, SR)
  setup(ctx)
  const t0 = performance.now()
  await ctx.startRendering()
  const ms = performance.now() - t0
  return { ms, realtime: ms / 1000 }
}

// Warm up all scenarios (JIT needs to see each code path)
for (const s of scenarios)
  for (const { OAC } of impls) await bench(OAC, s)

// Collect Node results[scenario][impl]
const nodeResults = []
for (const s of scenarios) {
  const row = []
  for (const { OAC } of impls) row.push(await bench(OAC, s))
  nodeResults.push(row)
}

// ── Browser via Playwright ───────────────────────────────────────────────────

let browserResults = null
let browserUA = null

async function runBrowser() {
  let playwright
  // Try local, then global
  for (const loc of ['playwright', '/opt/homebrew/lib/node_modules/playwright/index.js']) {
    try { playwright = await import(loc); break } catch {}
  }
  if (!playwright) {
    const req = createRequire(import.meta.url)
    try { playwright = req('playwright') } catch {}
  }
  if (!playwright) return null

  const pw = playwright.default ?? playwright
  const browser = await pw.chromium.launch({ headless: true })
  const page = await browser.newPage()
  const htmlPath = resolve(__dir, 'browser.html')
  await page.goto(`file://${htmlPath}`)
  // Wait for benchmark to finish (window.__benchResults set)
  await page.waitForFunction(() => window.__benchResults, { timeout: 60000 })
  const data = await page.evaluate(() => ({ results: window.__benchResults, ua: window.__benchUA }))
  await browser.close()
  return data
}

process.stdout.write('Running browser benchmark… ')
try {
  const data = await runBrowser()
  if (data) { browserResults = data.results; browserUA = data.ua; console.log('done') }
  else { console.log('skipped (playwright not found — run: npm install playwright)') }
} catch (e) {
  console.log(`skipped (${e.message.slice(0, 60)})`)
}

// ── Print combined table ─────────────────────────────────────────────────────

const allCols = [
  ...impls.map(i => i.name),
  browserResults ? `${browserUA ?? 'Chrome'} (native)` : null,
].filter(Boolean)

const COL = 20
const hdr = '\nScenario'.padEnd(32) + allCols.map(c => c.slice(0, COL - 1).padStart(COL)).join('')
console.log(hdr)
console.log('─'.repeat(hdr.trimStart().length + 1))

for (let i = 0; i < scenarios.length; i++) {
  let line = scenarios[i].name.padEnd(32)
  for (let j = 0; j < impls.length; j++) {
    const { ms, realtime } = nodeResults[i][j]
    line += `${ms.toFixed(1)}ms ${realtime < 1 ? '✓' : '✗'}`.padStart(COL)
  }
  if (browserResults?.[i]) {
    const { ms, realtime } = browserResults[i]
    line += `${ms.toFixed(1)}ms ${realtime < 1 ? '✓' : '✗'}`.padStart(COL)
  }
  console.log(line)
}

console.log()
if (impls.length === 1) console.log('  node-web-audio-api not installed — run: npm install node-web-audio-api')
if (!browserResults) console.log('  Browser results unavailable — run: npm install playwright')

console.log('\n  ✓ = faster than real-time  ✗ = slower than real-time')
