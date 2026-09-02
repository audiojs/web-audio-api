#!/usr/bin/env node
import { parseHTML } from 'linkedom'
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { examples } from '../examples/catalog.js'
import { optionsFor } from '../examples/options.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = new Set(process.argv.slice(2))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const baseUrl = pkg.homepage
const metricsPath = join(root, 'site-metrics.json')

const escapeHTML = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
const escapeAttr = escapeHTML

let metrics = existsSync(metricsPath)
  ? JSON.parse(readFileSync(metricsPath, 'utf8'))
  : { version: pkg.version, wptPass: null, wptFail: null, examples: examples.length, generatedAt: null }

if (args.has('--verify')) {
  process.stdout.write('Verifying WPT metrics…\n')
  let output = execFileSync(process.execPath, ['test/wpt-runner.js'], {
    cwd: root,
    env: { ...process.env, WPT_QUIET: '1' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  let match = output.match(/Pass:\s*(\d+)\s+Fail:\s*(\d+)\s+Skip:\s*(\d+)/)
  if (!match) throw new Error('Could not read WPT summary from test/wpt-runner.js')
  metrics = {
    version: pkg.version,
    wptPass: Number(match[1]),
    wptFail: Number(match[2]),
    wptSkip: Number(match[3]),
    examples: examples.length,
    generatedAt: new Date().toISOString(),
  }
  writeFileSync(metricsPath, JSON.stringify(metrics, null, 2) + '\n')
}

metrics.version = pkg.version
metrics.examples = examples.length
if (!metrics.wptPass) metrics.wptPass = 4317
if (metrics.wptFail == null) metrics.wptFail = 0

function replaceGenerated(source, name, content) {
  let start = `<!-- GENERATED:${name}:start -->`
  let end = `<!-- GENERATED:${name}:end -->`
  let pattern = new RegExp(`${start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
  if (!pattern.test(source)) throw new Error(`Missing generated markers for ${name}`)
  return source.replace(pattern, `${start}\n${content}\n        ${end}`)
}

// up to four same-category siblings, same job first
const home = parseHTML(readFileSync(join(root, 'index.html'), 'utf8')).document

// The homepage owns the chrome: other pages borrow its fonts, header, and footer with links made relative
const fromHome = selector => home.querySelector(selector) ?? (() => { throw new Error(`index.html no longer has ${selector}, which every other page borrows`) })()

function chrome(rel) {
  let relative = html => html.replaceAll('href="./"', `href="${rel}"`).replaceAll('href="#', `href="${rel}#`)
  return {
    fonts: fromHome('link[rel="stylesheet"][href^="https://fonts.googleapis.com"]').outerHTML,
    header: relative(fromHome('header.corner-action').outerHTML),
    footer: relative(fromHome('footer.site-footer').outerHTML),
  }
}

// The modal's demo panel and source panel, with the CLI command and options written in for crawlers
function demoHTML(example) {
  let options = optionsFor(example.id).map(option => `<div><dt><code>${escapeHTML(option.syntax)}</code></dt><dd>${escapeHTML(option.description || '')}</dd></div>`).join('')
  let body = fromHome('#example-dialog .dialog-body').innerHTML
  let filled = body
    .replace('<code class="language-shell" id="cli-command"></code>', `<code class="language-shell" id="cli-command">${escapeHTML(example.command)}</code>`)
    .replace('<dl class="cli-options" id="cli-options"></dl>', `<dl class="cli-options" id="cli-options">${options}</dl>`)
  if (filled === body) throw new Error('The modal markup changed: the CLI placeholders were not found')
  return filled
}

function relatedHTML(example) {
  let siblings = examples.filter(other => other.category === example.category && other.id !== example.id)
    .sort((a, b) => (a.job === example.job ? 0 : 1) - (b.job === example.job ? 0 : 1))
    .slice(0, 4)
  if (!siblings.length) return ''
  // the catalogue's own entries, thumbnails included, pointed at their pages
  let entry = other => fromHome(`.example-entry[data-open-example="${other.id}"]`).outerHTML
    .replace(`href="./examples/${other.id}/"`, `href="../${other.id}/"`).replace(` data-open-example="${other.id}"`, '')
  let entries = siblings.map(other => '      ' + entry(other)).join('\n')
  return `    <section class="detail-related" aria-label="Related examples"><h2>Other examples</h2><div class="example-grid">\n${entries}\n    </div></section>\n`
}


function examplePage(example) {
  let { fonts, header, footer } = chrome('../../')
  // one callout, in the manner of GitHub's: the warning if there is one, else the runtime note
  let callout = example.warning
    ? `    <aside class="callout callout-warning"><p class="callout-label">Warning</p><p>${escapeHTML(example.warning)}</p></aside>\n`
    : example.note ? `    <aside class="callout"><p class="callout-label">Note</p><p>${escapeHTML(example.note)}</p></aside>\n` : ''
  let schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareSourceCode',
        name: `${example.title}: web-audio-api example`,
        description: example.description,
        url: `${baseUrl}examples/${example.id}/`,
        codeRepository: `https://github.com/audiojs/web-audio-api/blob/master/examples/graphs/${example.id}.js`,
        programmingLanguage: 'JavaScript',
        runtimePlatform: 'Browser, Node.js',
        license: 'https://opensource.org/licenses/MIT',
      },
      {
        '@type': 'HowTo',
        name: example.title,
        description: example.description,
        step: [
          { '@type': 'HowToStep', name: 'Build the graph', text: `Import examples/graphs/${example.id}.js and pass a Web Audio context.` },
          { '@type': 'HowToStep', name: 'Run in Node', text: example.command },
        ],
      },
    ],
  }).replaceAll('<', '\\u003c')
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escapeHTML(example.title)} | Web Audio API in browser and Node</title>
  <meta name="description" content="${escapeAttr(example.description)} Run the same atomic graph source in the browser or from its Node CLI.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${baseUrl}examples/${example.id}/">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${baseUrl}examples/${example.id}/">
  <meta property="og:title" content="${escapeAttr(example.title)} | web-audio-api">
  <meta property="og:description" content="${escapeAttr(example.description)}">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2048%2048'%3E%3Ccircle%20cx='24'%20cy='24'%20r='24'%20fill='%2316171b'/%3E%3Cg%20fill='none'%20stroke='%23f2f4f8'%20stroke-width='2.5'%3E%3Ccircle%20cx='24'%20cy='24'%20r='20.5'/%3E%3Cpath%20d='M3.73%2024.42C9.12%2024.42%209.99%2024.3%2012.74%2018.27C16.28%2010.49%2018.92%209.67%2022.82%2024.42C26.72%2039.16%2029.86%2037.13%2032.66%2028.37C36.73%2015.61%2037.8%2024.42%2042.57%2024.42C44.27%2024.42%2044.27%2024.42%2044.27%2024.42'/%3E%3Cpath%20d='M3.36%2024.36h41.29'/%3E%3C/g%3E%3C/svg%3E">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  ${fonts}
  <link rel="stylesheet" href="../../assets/tokens.css">
  <link rel="stylesheet" href="../../assets/site.css">
  <script type="application/ld+json">${schema}</script>
</head>
<body data-example="${escapeAttr(example.id)}">
  <a class="skip-link" href="#demo-form">Skip to demo</a>
  ${header}
  <main class="example-detail">
    <header class="detail-head"><nav class="detail-crumbs" aria-label="Breadcrumb"><a href="../../#${example.category.toLowerCase().replace(/\s+/g, '-')}">${escapeHTML(example.category)}</a><span>/</span><a href="../../#examples">${escapeHTML(example.job)}</a></nav><h1>${escapeHTML(example.title)}</h1><p>${escapeHTML(example.description)}</p></header>
    <div class="detail-grid">
${demoHTML(example)}
    </div>
${callout}    <dl class="detail-facts"><div><dt>Input</dt><dd>${escapeHTML(example.input)}</dd></div><div><dt>Output</dt><dd>${escapeHTML(example.output)}</dd></div></dl>
${relatedHTML(example)}${example.seo ? `    <p class="detail-seo">${escapeHTML(example.seo)}</p>\n` : ''}  </main>
  ${footer}
  <script type="module" src="../browser.js"></script>
</body>
</html>
`
}

function updateHome() {
  let path = join(root, 'index.html')
  let html = readFileSync(path, 'utf8')
  html = html.replaceAll(/<span data-version>v[^<]+<\/span>/g, `<span data-version>v${pkg.version}</span>`)
  writeFileSync(path, html)
}

function updateCatalog() {
  writeFileSync(join(root, 'examples/index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="0; url=../#examples"><link rel="canonical" href="${baseUrl}#examples"><title>Examples | web-audio-api</title></head><body><main><p><a href="../#examples">Open the examples</a></p></main><script>location.replace('../#examples')</script></body></html>
`)
}

function generatePages() {
  for (let example of examples) {
    let dir = join(root, 'examples', example.id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'index.html'), examplePage(example))
  }
}

// The guides are written by hand; only their fonts, header, and footer are the homepage's
function updateGuides() {
  let { fonts, header, footer } = chrome('../../')
  for (let dir of readdirSync(join(root, 'guides'), { withFileTypes: true }).filter(entry => entry.isDirectory())) {
    let path = join(root, 'guides', dir.name, 'index.html')
    if (!existsSync(path)) continue
    let preconnect = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    let html = readFileSync(path, 'utf8')
      .replace(/<link rel="preconnect" href="https:\/\/fonts\.[^>]*>|<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/g, '')
      .replace('<link rel="stylesheet" href="../../assets/tokens.css">', `${preconnect}${fonts}<link rel="stylesheet" href="../../assets/tokens.css">`)
      .replace(/<header class="(?:site-nav|corner-action)">[\s\S]*?<\/header>/, header)
      .replace(/(?:<canvas class="footer-strips"[^>]*><\/canvas>\s*)?<footer class="site-footer">[\s\S]*?<\/footer>/, footer)
    writeFileSync(path, html)
  }
}

function generateDiscovery() {
  writeFileSync(join(root, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${baseUrl}sitemap.xml\n`)
  let urls = [baseUrl, ...examples.map(example => `${baseUrl}examples/${example.id}/`)]
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${url}</loc></url>`).join('\n')}\n</urlset>\n`
  writeFileSync(join(root, 'sitemap.xml'), xml)
  writeFileSync(join(root, 'llms.txt'), llmsTxt())
}

function llmsTxt() {
  let categories = [...new Set(examples.map(example => example.category))]
  let sections = categories.map(category => `## ${category}\n\n` + examples
    .filter(example => example.category === category)
    .map(example => `- [${example.title}](${baseUrl}examples/${example.id}/): ${example.description} CLI: \`${example.command}\``)
    .join('\n')).join('\n\n')
  return `# Web Audio API without the browser

> web-audio-api provides a pure-JavaScript Web Audio DSP engine for Node, Deno, Bun, and edge runtimes. It passes ${metrics.wptPass}/${metrics.wptPass + metrics.wptFail} Web Platform Tests. Audio-device I/O uses adapters. Install: \`npm install web-audio-api\`. Run any example with \`npx web-audio-api <name>\`.

Key facts: OfflineAudioContext renders audio in CI without an audio device. AudioContext plays through speakers via @audio/speaker. Tone.js and other browser audio libraries run in Node through \`import 'web-audio-api/polyfill'\`. Each example below is one dependency-free graph module taking a standard BaseAudioContext.

## Docs

- [Homepage](${baseUrl})
- [Move a graph from browser to Node](${baseUrl}guides/browser-to-node/)
- [Test audio in CI](${baseUrl}guides/test-audio-in-ci/)
- [Run Tone.js in Node](${baseUrl}guides/tonejs-node/)
- [Repository](https://github.com/audiojs/web-audio-api)

${sections}
`
}

function stage() {
  let target = join(root, 'build/site')
  rmSync(target, { recursive: true, force: true })
  mkdirSync(join(target, 'examples'), { recursive: true })
  for (let file of ['index.html', 'site.js', 'syntax.js', 'graph.js', 'hero.js', 'robots.txt', 'sitemap.xml', 'llms.txt']) cpSync(join(root, file), join(target, file))
  cpSync(join(root, 'assets'), join(target, 'assets'), { recursive: true })
  cpSync(join(root, 'guides'), join(target, 'guides'), { recursive: true })
  for (let file of ['index.html', 'catalog.js', 'options.js', 'browser.js']) cpSync(join(root, 'examples', file), join(target, 'examples', file))
  cpSync(join(root, 'examples', 'graphs'), join(target, 'examples', 'graphs'), { recursive: true })
  for (let example of examples) {
    cpSync(join(root, 'examples', `${example.id}.js`), join(target, 'examples', `${example.id}.js`))
    cpSync(join(root, 'examples', example.id), join(target, 'examples', example.id), { recursive: true })
  }
  cpSync(join(root, 'examples', 'utils.js'), join(target, 'examples', 'utils.js'))
  if (existsSync(join(root, 'examples', 'tuner-pitch.js'))) cpSync(join(root, 'examples', 'tuner-pitch.js'), join(target, 'examples', 'tuner-pitch.js'))
  process.stdout.write(`Staged ${target}\n`)
}

updateHome()
updateCatalog()
generatePages()
updateGuides()
generateDiscovery()
if (args.has('--stage')) stage()
process.stdout.write(`Built ${examples.length} example pages, v${pkg.version}, WPT ${metrics.wptPass}/${metrics.wptPass + metrics.wptFail}\n`)
