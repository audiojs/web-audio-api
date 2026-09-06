// Repeated offline-render throughput measurements; not a playback-latency test.
import { readFileSync, writeFileSync } from 'node:fs'
import { cpus, platform, arch } from 'node:os'
import { OfflineAudioContext } from '../index.js'
import { scenarios, SR, LENGTH } from './scenarios.js'

let RustOAC
try { RustOAC = (await import('node-web-audio-api')).OfflineAudioContext } catch {}
const packageVersion = name => {
  try { return JSON.parse(readFileSync(new URL(name, import.meta.url))).version } catch { return null }
}
const impls = [
  { name: 'web-audio-api (JS)', version: packageVersion('../package.json'), OAC: OfflineAudioContext },
  RustOAC ? { name: 'node-web-audio-api (Rust)', version: packageVersion('../node_modules/node-web-audio-api/package.json'), OAC: RustOAC } : null,
].filter(Boolean)

const warmup = 10, repetitions = 50
async function bench(OAC, scenario) {
  const ctx = new OAC(scenario.channels, LENGTH, SR)
  scenario.setup(ctx)
  const start = performance.now()
  const buffer = await ctx.startRendering()
  const ms = performance.now() - start
  // Validation is outside the timed region. Do not publish timings for broken output.
  if (buffer.length !== LENGTH || buffer.numberOfChannels !== scenario.channels || buffer.sampleRate !== SR)
    throw Error(`${scenario.name}: unexpected output shape`)
  let peak = 0
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    for (let value of buffer.getChannelData(ch)) {
      if (!Number.isFinite(value)) throw Error(`${scenario.name}: non-finite output`)
      peak = Math.max(peak, Math.abs(value))
    }
  }
  if (scenario.name !== 'silence (baseline)' && peak === 0) throw Error(`${scenario.name}: silent output`)
  return ms
}

const results = []
for (const scenario of scenarios) {
  const times = impls.map(() => [])
  for (let run = -warmup; run < repetitions; run++) {
    // Alternate order to reduce systematic first/second-run bias.
    for (let j = 0; j < impls.length; j++) {
      const i = (j + Math.abs(run)) % impls.length
      const ms = await bench(impls[i].OAC, scenario)
      if (run >= 0) times[i].push(ms)
    }
  }
  results.push(times.map(samples => {
    const sorted = [...samples].sort((a, b) => a - b)
    const ms = (sorted[24] + sorted[25]) / 2
    return { ms, p95: sorted[Math.ceil(repetitions * 0.95) - 1], samples, realtime: ms / 1000 / (LENGTH / SR) }
  }))
}

const report = {
  measuredAt: new Date().toISOString(),
  system: { cpu: cpus()[0]?.model, platform: platform(), arch: arch(), node: process.version },
  method: { warmup, repetitions, duration: LENGTH / SR, sampleRate: SR, timing: 'startRendering only; graph construction and validation excluded' },
  implementations: impls.map(({ name, version }) => ({ name, version })),
  scenarios: scenarios.map((scenario, i) => ({ name: scenario.name, channels: scenario.channels, results: results[i] })),
}
if (process.argv.includes('--save')) writeFileSync(new URL('./results.json', import.meta.url), JSON.stringify(report, null, 2) + '\n')
if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2))
else {
  console.log(`${report.system.cpu}, ${platform()} ${arch()}, Node ${process.version}`)
  console.log(`${warmup} warm-ups, ${repetitions} measured renders; median / p95 in ms. Graph setup excluded.\n`)
  console.log('Scenario'.padEnd(32) + impls.map(i => `${i.name} v${i.version}`.padStart(34)).join(''))
  for (let i = 0; i < scenarios.length; i++) console.log(scenarios[i].name.padEnd(32) + results[i].map(r => `${r.ms.toFixed(2)} / ${r.p95.toFixed(2)}`.padStart(34)).join(''))
}
export { results, impls, scenarios }
