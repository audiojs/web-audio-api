// Node.js comparison benchmark: web-audio-api vs node-web-audio-api
import { OfflineAudioContext } from '../index.js'
import { scenarios, SR, LENGTH } from './scenarios.js'

// Try to load node-web-audio-api (Rust-backed)
let RustOAC
try {
  const m = await import('node-web-audio-api')
  RustOAC = m.OfflineAudioContext
} catch {}

const impls = [
  { name: 'web-audio-api (JS)', OAC: OfflineAudioContext },
  RustOAC ? { name: 'node-web-audio-api (Rust)', OAC: RustOAC } : null,
].filter(Boolean)

/**
 * @param {typeof OfflineAudioContext} OAC
 * @param {{ name: string, channels: number, setup: Function }} scenario
 * @returns {{ ms: number, blocksPerSec: number, realtime: number }}
 */
async function bench(OAC, { channels, setup }) {
  const ctx = new OAC(channels, LENGTH, SR)
  setup(ctx)
  const start = performance.now()
  await ctx.startRendering()
  const ms = performance.now() - start
  return { ms, blocksPerSec: (LENGTH / 128) / (ms / 1000), realtime: ms / 1000 / (LENGTH / SR) }
}

// Warm up all scenarios (JIT needs to see each code path)
for (const scenario of scenarios)
  for (const { OAC } of impls) await bench(OAC, scenario)

// Collect results: results[scenarioIdx][implIdx]
const results = []
for (const scenario of scenarios) {
  const row = []
  for (const { OAC } of impls) row.push(await bench(OAC, scenario))
  results.push(row)
}

// Print table
const COL = 16
const header = 'Scenario'.padEnd(32) + impls.map(i => i.name.padStart(COL)).join('')
console.log(header)
console.log('─'.repeat(header.length))
for (let i = 0; i < scenarios.length; i++) {
  let line = scenarios[i].name.padEnd(32)
  for (let j = 0; j < impls.length; j++) {
    const { ms, realtime } = results[i][j]
    const tag = realtime < 1 ? `${ms.toFixed(1)}ms ✓` : `${ms.toFixed(1)}ms ✗`
    line += tag.padStart(COL)
  }
  console.log(line)
}

if (!RustOAC) {
  console.log('\n  node-web-audio-api not installed — run: npm install node-web-audio-api')
}

// Export for run-all.js
export { results, impls, scenarios }
