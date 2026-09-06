// Optional compiler check: install JZ separately, then set JZ_MODULE to its index.js.
// Compilation and Wasm validation only; this is not a runtime or WPT result.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const moduleURL = process.env.JZ_MODULE ? pathToFileURL(resolve(process.env.JZ_MODULE)) : import.meta.resolve('jz')
const { compile } = await import(moduleURL)
const version = JSON.parse(readFileSync(new URL('./package.json', moduleURL))).version
const external = ['@audio/decode', '@audio/decode-ape', '@audio/speaker', '@audio/mic']
const { outputFiles } = await build({
  entryPoints: ['test/compiler-smoke.mjs'], bundle: true, write: false, format: 'esm', platform: 'neutral', mainFields: ['module', 'main'], external,
  plugins: [{ name: 'worklet-host-boundary', setup(build) {
    build.onResolve({ filter: /worklet-module\.js$/ }, () => ({ path: 'web-audio-worklet-host', external: true }))
  } }],
})
const imports = Object.fromEntries([...external, 'web-audio-worklet-host'].map(spec => [spec, { default: { params: 8 }, from: { params: 8 }, evaluateWorkletModule: { params: 2 } }]))
const report = { compiler: 'jz', version, measuredAt: new Date().toISOString(), entry: 'test/compiler-smoke.mjs', external: [...external, 'src/worklet-module.js'], optimize: 2 }
try {
  const start = performance.now()
  const bytes = compile(outputFiles[0].text, { imports, optimize: 2 })
  report.compileMs = performance.now() - start
  report.wasmBytes = bytes.byteLength
  report.valid = WebAssembly.validate(bytes)
  report.status = report.valid ? 'compiled' : 'invalid-wasm'
  if (!report.valid) process.exitCode = 1
} catch (error) {
  report.status = 'compile-error'
  report.error = error.message
  process.exitCode = 1
}
console.log(JSON.stringify(report, null, 2))
