// Host loading and evaluation for URL worklets. Offline DSP never calls this adapter.
export function evaluateWorkletModule(code, scope) {
  // Bare currentTime/currentFrame identifiers must read live getters. This is an
  // execution scope, not a security sandbox: load trusted processor code only.
  // The outer non-strict scope supplies live bindings; module code stays strict
  // and unmodified. A newline terminates any final line comment.
  new Function('_s', 'with(_s){return (function(){"use strict";\n' + code + '\n}).call(undefined)}')(scope)
}

export default async function readWorkletModule(url, basePath) {
  if (url.startsWith('data:')) {
    const comma = url.indexOf(',')
    if (comma < 0) throw new Error('Invalid data URI')
    const meta = url.slice(5, comma).toLowerCase()
    const body = url.slice(comma + 1)
    if (/;base64$/.test(meta.trimEnd())) {
      const bytes = Uint8Array.from(atob(decodeURIComponent(body)), ch => ch.charCodeAt(0))
      return new TextDecoder().decode(bytes)
    }
    return decodeURIComponent(body)
  }

  if (url.startsWith('blob:')) return await fetch(url).then(res => res.text())

  let fs, path
  try { fs = await import('node:fs'); path = await import('node:path') } catch {
    throw new Error('addModule(url) with a file path requires a Node-compatible filesystem; use addModule(fn) in browser')
  }
  return fs.readFileSync(path.resolve(basePath || process.cwd(), url), 'utf8')
}
