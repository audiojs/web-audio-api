const moduleUrl = 'https://cdn.jsdelivr.net/npm/microlighter@2.1.0/dist/index.js'
let loader

export async function highlightSyntax(root = document) {
  if (!window.CSS?.highlights) return []
  loader ||= import(moduleUrl)
  let { highlightAll } = await loader
  return highlightAll({ root })
}
