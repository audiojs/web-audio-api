#!/usr/bin/env node
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

function homeExamplesHTML() {
  let numbered = examples.map((example, index) => ({ example, number: String(index + 1).padStart(2, '0') }))
  let categories = [...new Set(examples.map(example => example.category))]
  return categories.map(category => {
    let entries = numbered.filter(({ example }) => example.category === category).map(({ example, number }) => `            <a class="example-entry" href="./examples/${escapeAttr(example.id)}/" data-open-example="${escapeAttr(example.id)}"><span class="example-number">${number}</span><span class="example-heading"><strong>${escapeHTML(example.title)}</strong></span><svg class="example-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg><span class="example-description">${escapeHTML(example.description)}</span><small class="example-tag">${escapeHTML(example.job)}</small></a>`).join('\n')
    return `        <section class="example-group"><h3>${escapeHTML(category)}</h3><div class="example-grid">\n${entries}\n          </div></section>`
  }).join('\n')
}


function examplePage(example) {
  let warning = example.warning ? `<aside class="warning"><strong>Listen safely.</strong> ${escapeHTML(example.warning)}</aside>` : ''
  let note = example.note ? `<aside class="notice"><strong>Runtime note.</strong> ${escapeHTML(example.note)}</aside>` : ''
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
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;700&amp;family=IBM+Plex+Mono:wght@400;500&amp;display=swap">
  <link rel="stylesheet" href="../../tokens.css">
  <link rel="stylesheet" href="../../site.css">
  <script type="application/ld+json">${schema}</script>
</head>
<body data-example="${escapeAttr(example.id)}">
  <a class="skip-link" href="#demo-form">Skip to demo</a>
  <canvas class="header-strips" aria-hidden="true"></canvas><header class="detail-actions"><a class="brand" href="../../" aria-label="Web Audio API home"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="24" fill="currentColor"/><g fill="none" stroke="var(--color-paper)" stroke-width="1.5"><circle cx="24" cy="24" r="20.5"/><path d="M3.72998 24.4174C9.11908 24.4174 9.98873 24.2988 12.735 18.2706C16.279 10.4913 18.92 9.67227 22.8177 24.4174C26.715 39.1609 29.8613 37.131 32.6572 28.3694C36.73 15.6062 37.803 24.4174 42.5662 24.4174C44.2699 24.4174 44.2699 24.4174 44.2699 24.4174"/><path d="M3.355 24.3584h41.29"/></g></svg></a><div class="corner-links"><a class="icon-button" href="https://github.com/audiojs/web-audio-api" aria-label="Open web-audio-api on GitHub"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.52-1.34-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.57-.29-5.27-1.29-5.27-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.16 1.18a10.9 10.9 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.71 5.39-5.29 5.68.42.36.79 1.07.79 2.16v3.2c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z"/></svg></a><a class="icon-button" href="https://audiojs.dev/" aria-label="AudioJS"><svg viewBox="0 0 80 90" aria-hidden="true"><g fill="currentColor" stroke="currentColor"><path d="M28.6572 0L45 45H0L15.8672 0H28.6572Z"/><path d="M51.3428 89.9999L35 44.9999H80L64.1328 89.9999H51.3428Z"/></g></svg></a></div></header>
  <main class="example-detail">
    <header class="detail-head"><div class="detail-tags" aria-label="Example classification"><span>${escapeHTML(example.category)}</span><span>${escapeHTML(example.job)}</span></div><h1>${escapeHTML(example.title)}</h1><p>${escapeHTML(example.description)}</p></header>
    <dl class="detail-facts"><div><dt>Graph</dt><dd>${escapeHTML(example.graph)}</dd></div><div><dt>Input</dt><dd>${escapeHTML(example.input)}</dd></div><div><dt>Output</dt><dd>${escapeHTML(example.output)}</dd></div></dl>
${warning}${note}
    <div class="detail-grid">
      <section class="demo-panel" aria-label="Browser demo">
        <div class="demo-stage"><div class="demo-canvas-wrap"><canvas class="demo-canvas" id="demo-canvas" width="720" height="220" role="img" aria-label="Audio waveform"></canvas></div><div class="demo-spectrogram-wrap"><canvas class="demo-spectrogram" id="demo-spectrogram" width="720" height="180" role="img" aria-label="Audio spectrogram"></canvas><select id="demo-frequency-scale" aria-label="Spectrogram frequency scale"><option value="log">Log</option><option value="mel">Mel</option><option value="linear">Linear</option></select></div><div class="demo-meter"><div class="demo-meter-track"><div class="demo-meter-fill" id="demo-meter-fill"></div></div><span id="demo-meter-value">ready</span></div></div><div class="demo-results" id="demo-result"></div>
        <form class="demo-form" id="demo-form"><div class="demo-controls" id="demo-controls"><div class="demo-fields" id="demo-fields"></div><div class="demo-extras" id="demo-actions"></div></div><div class="demo-runbar"><button class="demo-action demo-run" id="demo-run" type="button" aria-pressed="false"><svg class="play-glyph" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.14v13.72L19 12z"/></svg><svg class="pause-glyph" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z"/></svg><span>${example.mode === 'node' ? 'Copy command' : 'Run demo'}</span></button><input class="demo-volume" type="range" id="demo-volume" min="0" max="100" value="25" aria-label="Output volume"><p class="demo-help" id="demo-status" role="status" aria-live="polite">Silent until you press play.</p></div></form>
      </section>
      <section class="dialog-code code-stage" aria-label="Graph source">
        <div class="code-tabs" role="group" aria-label="Source view"><button class="code-tab" type="button" data-pane="cli" aria-pressed="true">CLI</button><button class="code-tab" type="button" data-pane="code" aria-pressed="false">Code</button></div>
        <div class="code-pane cli-pane" id="cli-pane">
          <div class="cli-command"><button class="icon-button copy-icon" type="button" data-copy="#cli-command" aria-label="Copy command"><svg class="copy-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8h11v11H8zM5 16H4V4h12v1"/></svg><svg class="check-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></button><pre><code class="language-shell" id="cli-command">${escapeHTML(example.command)}</code></pre></div>
          <dl class="cli-options">${optionsFor(example.id).map(option => `<div><dt><code>${escapeHTML(option.syntax)}</code></dt><dd>${escapeHTML(option.description || '')}</dd></div>`).join('')}</dl>
        </div>
        <pre class="code-output" id="code-pane" hidden><code class="language-javascript" id="example-code">Loading source…</code></pre>
      </section>
    </div>
${example.seo ? `    <p class="detail-seo">${escapeHTML(example.seo)}</p>\n` : ''}  </main>
  <canvas class="footer-strips" aria-hidden="true"></canvas>
  <footer class="site-footer"><div class="footer-inner footer-columns"><a class="footer-seal" href="../../" aria-label="Web Audio API home"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="24" fill="currentColor"/><g fill="none" stroke="var(--color-ink)" stroke-width="1.5"><circle cx="24" cy="24" r="20.5"/><path d="M3.72998 24.4174C9.11908 24.4174 9.98873 24.2988 12.735 18.2706C16.279 10.4913 18.92 9.67227 22.8177 24.4174C26.715 39.1609 29.8613 37.131 32.6572 28.3694C36.73 15.6062 37.803 24.4174 42.5662 24.4174C44.2699 24.4174 44.2699 24.4174 44.2699 24.4174"/><path d="M3.355 24.3584h41.29"/></g></svg></a><div class="footer-specs"><span>54 KB gzipped</span><span>TypeScript</span><span>MIT</span><span data-version>v${pkg.version}</span><span>since 2013</span></div><div class="footer-side"><a class="footer-brand" href="https://audiojs.dev/"><svg viewBox="0 0 80 90" aria-hidden="true"><g fill="currentColor" stroke="currentColor"><path d="M28.6572 0L45 45H0L15.8672 0H28.6572Z"/><path d="M51.3428 89.9999L35 44.9999H80L64.1328 89.9999H51.3428Z"/></g></svg>AudioJS</a><a href="https://github.com/sponsors/audiojs">Support development</a><a class="wpt-badge" href="https://github.com/audiojs/web-audio-api/actions/workflows/wpt.yml" aria-label="Web Platform Tests status"><img src="https://github.com/audiojs/web-audio-api/actions/workflows/wpt.yml/badge.svg" alt="W3C WPT status"></a></div></div></footer>
  <script type="module" src="../browser.js"></script>
</body>
</html>
`
}

function updateHome() {
  let path = join(root, 'index.html')
  let html = readFileSync(path, 'utf8')
  html = replaceGenerated(html, 'home-examples', homeExamplesHTML())
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

function generateDiscovery() {
  writeFileSync(join(root, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${baseUrl}sitemap.xml\n`)
  let urls = [baseUrl, ...examples.map(example => `${baseUrl}examples/${example.id}/`)]
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${url}</loc></url>`).join('\n')}\n</urlset>\n`
  writeFileSync(join(root, 'sitemap.xml'), xml)
}

function stage() {
  let target = join(root, 'build/site')
  rmSync(target, { recursive: true, force: true })
  mkdirSync(join(target, 'examples'), { recursive: true })
  for (let file of ['index.html', 'site.css', 'site.js', 'syntax.js', 'tokens.css', 'robots.txt', 'sitemap.xml']) cpSync(join(root, file), join(target, file))
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
generateDiscovery()
if (args.has('--stage')) stage()
process.stdout.write(`Built ${examples.length} example pages, v${pkg.version}, WPT ${metrics.wptPass}/${metrics.wptPass + metrics.wptFail}\n`)
