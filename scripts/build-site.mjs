#!/usr/bin/env node
import { parseHTML } from 'linkedom'
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { examples } from '../examples/catalog.js'
import { optionsFor } from '../examples/options.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = new Set(process.argv.slice(2))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const baseUrl = pkg.homepage
const metricsPath = join(root, 'site-metrics.json')
const sitePath = new URL(baseUrl).pathname

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

const text = value => typeof value === 'string' && value.trim().length > 0
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
if (!Number.isSafeInteger(metrics?.wptPass) || metrics.wptPass <= 0 || metrics.wptFail !== 0 || metrics.wptSkip !== 0 || !text(metrics.version) || !timestamp(metrics.generatedAt))
  throw new Error('Verified WPT results required: run npm run site:verify')

// Validate both evidence sources before changing any published files. A report
// must contain measurements, and its advertised statistics must agree with them.
const report = JSON.parse(readFileSync(join(root, 'benchmark/results.json'), 'utf8'))
const requireBenchmark = condition => {
  if (!condition) throw new Error('Verified benchmark results required: run npm run bench:compare -- --save')
}
const method = report?.method
requireBenchmark(timestamp(report?.measuredAt) && ['cpu', 'platform', 'arch', 'node'].every(key => text(report.system?.[key])))
requireBenchmark(Number.isSafeInteger(method?.repetitions) && method.repetitions > 0 && Number.isSafeInteger(method.warmup) && method.warmup >= 0
  && [method.duration, method.sampleRate].every(value => Number.isFinite(value) && value > 0))
requireBenchmark(Array.isArray(report.implementations) && report.implementations.length > 0 && report.implementations.every(i => text(i?.name) && text(i?.version))
  && Array.isArray(report.scenarios) && report.scenarios.length > 0)
for (const scenario of report.scenarios) {
  requireBenchmark(text(scenario?.name) && Number.isSafeInteger(scenario.channels) && scenario.channels > 0
    && Array.isArray(scenario.results) && scenario.results.length === report.implementations.length)
  for (const result of scenario.results) {
    requireBenchmark(Array.isArray(result?.samples) && result.samples.length === method.repetitions && result.samples.every(value => Number.isFinite(value) && value >= 0))
    const sorted = [...result.samples].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2)
    const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
    requireBenchmark(result.ms === median && result.p95 === sorted[Math.ceil(sorted.length * 0.95) - 1] && result.realtime === median / 1000 / method.duration)
  }
}

// up to four same-category siblings, same job first
let home = parseHTML(readFileSync(join(root, 'index.html'), 'utf8')).document
const catalogue = parseHTML(readFileSync(join(root, 'examples/index.html'), 'utf8')).document

// The homepage owns the chrome: other pages borrow its fonts, icons, social card, header, and footer with links made relative
const fromHome = selector => home.querySelector(selector) ?? (() => { throw new Error(`index.html no longer has ${selector}, which every other page borrows`) })()
const allFromHome = selector => { let found = [...home.querySelectorAll(selector)]; if (!found.length) throw new Error(`index.html no longer has ${selector}, which every other page borrows`); return found }

function chrome(rel) {
  let relative = html => html.replaceAll('href="./', () => `href="${rel}`).replaceAll('href="#', () => `href="${rel}#`)
  let lines = nodes => nodes.map(node => relative(node.outerHTML)).join('\n  ')
  return {
    fonts: lines(allFromHome('link[rel="preload"][as="font"]')),
    icons: lines([fromHome('link[rel="icon"]'), fromHome('link[rel="apple-touch-icon"]')]),
    card: lines(allFromHome('meta[property^="og:image"], meta[name="twitter:card"], meta[name="theme-color"]')),
    header: relative(fromHome('header.corner-action').outerHTML),
    footer: relative([fromHome('canvas.footer-strips'), fromHome('footer.site-footer')].map(node => node.outerHTML).join('\n  ')),
  }
}

// The modal's demo panel and source panel, with the CLI command and options written in for crawlers
function demoHTML(example) {
  let options = optionsFor(example.id).map(option => `<div><dt><code>${escapeHTML(option.syntax)}</code></dt><dd>${escapeHTML(option.description || '')}</dd></div>`).join('')
  let body = fromHome('#example-dialog .dialog-body').innerHTML
  let filled = body
    .replace('<code class="language-shell" id="cli-command"></code>', () => `<code class="language-shell" id="cli-command">${escapeHTML(example.command)}</code>`)
    .replace('<dl class="cli-options" id="cli-options"></dl>', () => `<dl class="cli-options" id="cli-options">${options}</dl>`)
  if (filled === body) throw new Error('The modal markup changed: the CLI placeholders were not found')
  return filled
}

function relatedHTML(example) {
  let siblings = examples.filter(other => other.category === example.category && other.id !== example.id)
    .sort((a, b) => (a.job === example.job ? 0 : 1) - (b.job === example.job ? 0 : 1))
    .slice(0, 4)
  if (!siblings.length) return ''
  // the catalogue's own entries, thumbnails included, pointed at their pages
  let entry = other => {
    let node = catalogue.querySelector(`.example-entry[href="./${other.id}/"]`)
    if (!node) throw new Error(`examples/index.html has no entry for ${other.id}`)
    return node.outerHTML.replace(`href="./${other.id}/"`, `href="../${other.id}/"`)
  }
  let entries = siblings.map(other => '      ' + entry(other)).join('\n')
  return `    <section class="detail-related" aria-label="Related examples"><h2>Other examples</h2><div class="example-grid">\n${entries}\n    </div></section>\n`
}


function examplePage(example) {
  let { fonts, icons, card, header, footer } = chrome('../../')
  // one callout, in the manner of GitHub's: the warning if there is one, else the runtime note
  let callout = example.warning
    ? `    <aside class="callout callout-warning"><p class="callout-label">Warning</p><p>${escapeHTML(example.warning)}</p></aside>\n`
    : example.note ? `    <aside class="callout"><p class="callout-label">Note</p><p>${escapeHTML(example.note)}</p></aside>\n` : ''
  let schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: `${example.title}: web-audio-api example`,
    description: example.description,
    url: `${baseUrl}examples/${example.id}/`,
    codeRepository: `https://github.com/audiojs/web-audio-api/blob/master/examples/graphs/${example.id}.js`,
    programmingLanguage: 'JavaScript',
    runtimePlatform: 'Browser, Node.js',
    license: 'https://opensource.org/licenses/MIT',
  }).replaceAll('<', '\\u003c')
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escapeHTML(example.title)} | Web Audio API in browser and Node</title>
  <meta name="description" content="${escapeAttr(example.description)} Preview with native browser Web Audio or run the graph with web-audio-api in Node.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${baseUrl}examples/${example.id}/">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${baseUrl}examples/${example.id}/">
  <meta property="og:title" content="${escapeAttr(example.title)} | web-audio-api">
  <meta property="og:description" content="${escapeAttr(example.description)}">
  ${card}
  ${icons}
  ${fonts}
  <link rel="stylesheet" href="../../assets/tokens.css">
  <link rel="stylesheet" href="../../assets/site.css">
  <script type="application/ld+json">${schema}</script>
</head>
<body data-example="${escapeAttr(example.id)}">
  <a class="skip-link" href="#demo-form">Skip to demo</a>
  ${header}
  <main class="example-detail">
    <header class="detail-head"><nav class="detail-crumbs" aria-label="Breadcrumb"><a href="../">Examples</a><span>/</span><a href="../#${example.category.toLowerCase().replace(/\s+/g, '-')}">${escapeHTML(example.category)}</a></nav><h1>${escapeHTML(example.title)}</h1><p>${escapeHTML(example.description)}</p></header>
    <div class="detail-grid">
${demoHTML(example)}
    </div>
${callout}
${relatedHTML(example)}${example.seo ? `    <div class="detail-seo"><p>${escapeHTML(example.seo)}</p></div>\n` : ''}  </main>
  ${footer}
  <script type="module" src="../browser.js"></script>
</body>
</html>
`
}

// version and packed size come from the package itself, so the hero cannot drift from what npm ships
function updateHome() {
  let path = join(root, 'index.html')
  let html = readFileSync(path, 'utf8')
  html = html.replaceAll(/<span data-version(?:="")?>v[^<]+<\/span>/g, () => `<span data-version>v${escapeHTML(pkg.version)}</span>`)
  let [{ size }] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))
  if (!html.includes(' data-pack-size')) throw new Error('index.html no longer has the data-pack-size link')
  html = html.replaceAll(/(<(a|span)[^>]* data-pack-size(?:="")?>)[^<]*(<\/\2>)/g, `$1${Math.round(size / 1000)} KB gzip$3`)
  html = html.replaceAll(/(<span data-wpt-count(?:="")?>)[^<]*(<\/span>)/g, `$1${metrics.wptPass.toLocaleString('en-US')}$2`)
    .replaceAll(/(<span data-wpt-version(?:="")?>)[^<]*(<\/span>)/g, (_, open, close) => `${open}v${escapeHTML(metrics.version)}${close}`)
    .replaceAll(/(<time data-wpt-date(?:="")?>)[^<]*(<\/time>)/g, `$1${metrics.generatedAt.slice(0, 10)}$2`)
  const heading = report.implementations.map(i => `<th scope="col">${escapeHTML(i.name)} v${escapeHTML(i.version)}<br>median / p95</th>`).join('')
  const rows = report.scenarios.map(s => `<tr><th scope="row">${escapeHTML(s.name)}</th>${s.results.map(r => `<td>${r.ms.toFixed(2)} / ${r.p95.toFixed(2)} ms</td>`).join('')}</tr>`).join('\n')
  const { system, method } = report
  const caption = `${method.duration} s of audio at ${method.sampleRate} Hz. ${escapeHTML(system.cpu)}, ${escapeHTML(system.platform)} ${escapeHTML(system.arch)}, Node ${escapeHTML(system.node)}. ${method.warmup} warm-ups, ${method.repetitions} measurements; graph construction excluded. ${report.measuredAt.slice(0, 10)}. <a href="https://github.com/audiojs/web-audio-api/blob/master/benchmark/results.json">Raw results</a>; reproduce with <code>npm run bench:compare</code>.`
  html = html.replace(/<table class="bench">[\s\S]*?<\/table>/, () => `<table class="bench"><caption>${caption}</caption><thead><tr><th scope="col">Scenario</th>${heading}</tr></thead><tbody>${rows}</tbody></table>`)
  writeFileSync(path, html)
}

// GitHub Pages serves this for any missing path under the site, so its links are absolute
function notFoundPage() {
  let { fonts, icons, card, header, footer } = chrome(sitePath)
  writeFileSync(join(root, '404.html'), `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Not found | web-audio-api</title>
  <meta name="robots" content="noindex">
  ${card}
  ${icons}
  ${fonts}
  <link rel="stylesheet" href="${sitePath}assets/tokens.css">
  <link rel="stylesheet" href="${sitePath}assets/site.css">
</head>
<body>
  ${header}
  <main class="example-detail not-found">
    <header class="detail-head"><h1>Not found</h1><p>No page lives at this address. <a href="${sitePath}examples/">Browse the examples</a> or <a href="${sitePath}">start from the homepage</a>.</p></header>
  </main>
  ${footer}
  <script type="module" src="${sitePath}examples/browser.js"></script>
</body>
</html>
`)
}

function updateCatalog() {
  let { fonts, header, footer } = chrome('../')
  let path = join(root, 'examples/index.html')
  let html = readFileSync(path, 'utf8')
    // A quoted > is attribute text, not the end of a link tag. Parse attributes
    // without serializing the whole catalogue and rewriting its SVGs.
    .replace(/<link\b(?:[^"'<>]|"[^"]*"|'[^']*')*>\s*/gi, tag => {
      const link = parseHTML(tag).document.querySelector('link')
      const rel = link.getAttribute('rel'), href = link.getAttribute('href') || ''
      return (rel === 'preload' && link.getAttribute('as') === 'font')
        || (rel === 'preconnect' && href.startsWith('https://fonts.'))
        || (rel === 'stylesheet' && href.startsWith('https://fonts.googleapis.com')) ? '' : tag
    })
    .replace('<link rel="stylesheet" href="../assets/tokens.css">', () => `${fonts}\n  <link rel="stylesheet" href="../assets/tokens.css">`)
    .replace(/<header class="corner-action">[\s\S]*?<\/header>/, () => header)
    .replace(/(?:<canvas class="footer-strips"[^>]*><\/canvas>\s*)?<footer class="site-footer">[\s\S]*?<\/footer>/, () => footer)
  writeFileSync(path, html)
}

function generatePages() {
  for (let example of examples) {
    let dir = join(root, 'examples', example.id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'index.html'), examplePage(example))
  }
}

function generateDiscovery() {
  writeFileSync(join(root, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${baseUrl}sitemap.xml\n`)
  let urls = [baseUrl, `${baseUrl}examples/`, ...examples.map(example => `${baseUrl}examples/${example.id}/`)]
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

> web-audio-api provides a pure-JavaScript Web Audio DSP engine for Node, Deno, Bun, and edge runtimes. The Node runner recorded ${metrics.wptPass} passing Web Platform Tests for v${metrics.version} on ${metrics.generatedAt.slice(0, 10)}; this is not W3C certification. Audio-device I/O uses adapters. Install: \`npm install web-audio-api\`. Run any example with \`npx web-audio-api <name>\`.

Key facts: OfflineAudioContext renders audio in CI without an audio device. AudioContext plays through speakers via @audio/speaker. Tone.js and other browser audio libraries run in Node through \`import 'web-audio-api/polyfill'\`. Each example below is one dependency-free graph module taking a standard BaseAudioContext.

## Docs

- [Homepage](${baseUrl})
- [All examples](${baseUrl}examples/)
- [Repository](https://github.com/audiojs/web-audio-api)

${sections}
`
}

function stage() {
  let target = join(root, 'build/site')
  rmSync(target, { recursive: true, force: true })
  mkdirSync(join(target, 'examples'), { recursive: true })
  for (let file of ['index.html', '404.html', 'site.js', 'syntax.js', 'graph.js', 'hero.js', 'robots.txt', 'sitemap.xml', 'llms.txt']) cpSync(join(root, file), join(target, file))
  cpSync(join(root, 'assets'), join(target, 'assets'), { recursive: true })
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
// Refresh shared chrome after generated metrics/version updates.
home = parseHTML(readFileSync(join(root, 'index.html'), 'utf8')).document
updateCatalog()
generatePages()
notFoundPage()
generateDiscovery()
if (args.has('--stage')) stage()
process.stdout.write(`Built ${examples.length} example pages, v${pkg.version}, WPT ${metrics.wptPass}/${metrics.wptPass + metrics.wptFail}\n`)
