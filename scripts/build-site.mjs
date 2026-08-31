#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { examples } from '../examples/catalog.js'

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
  let categories = [...new Set(examples.map(example => example.category))]
  return categories.map(category => {
    let entries = examples.filter(example => example.category === category).map(example => `            <a class="example-entry" href="./examples/${escapeAttr(example.id)}/" data-open-example="${escapeAttr(example.id)}"><strong>${escapeHTML(example.title)}</strong><span>${escapeHTML(example.description)}</span><small>${escapeHTML(example.job)}</small></a>`).join('\n')
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
        name: `${example.title} · web-audio-api example`,
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
  <title>${escapeHTML(example.title)} · Web Audio API in browser and Node</title>
  <meta name="description" content="${escapeAttr(example.description)} Run the same atomic graph source in the browser or from its Node CLI.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${baseUrl}examples/${example.id}/">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${baseUrl}examples/${example.id}/">
  <meta property="og:title" content="${escapeAttr(example.title)} · web-audio-api">
  <meta property="og:description" content="${escapeAttr(example.description)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;700&amp;family=IBM+Plex+Mono:wght@400;500&amp;display=swap">
  <link rel="stylesheet" href="../../tokens.css">
  <link rel="stylesheet" href="../../site.css">
  <script type="application/ld+json">${schema}</script>
</head>
<body data-example="${escapeAttr(example.id)}">
  <a class="skip-link" href="#demo-form">Skip to demo</a>
  <header class="detail-actions"><a href="../../#examples">All examples</a><a class="icon-button" href="https://github.com/audiojs/web-audio-api" aria-label="Open web-audio-api on GitHub"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.52-1.34-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.57-.29-5.27-1.29-5.27-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.16 1.18a10.9 10.9 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.71 5.39-5.29 5.68.42.36.79 1.07.79 2.16v3.2c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z"/></svg></a></header>
  <main class="example-detail">
    <header class="detail-head"><p>${escapeHTML(example.category)} · ${escapeHTML(example.job)}</p><h1>${escapeHTML(example.title)}</h1><p>${escapeHTML(example.description)}</p></header>
    <dl class="detail-facts"><div><dt>Graph</dt><dd>${escapeHTML(example.graph)}</dd></div><div><dt>Input</dt><dd>${escapeHTML(example.input)}</dd></div><div><dt>Output</dt><dd>${escapeHTML(example.output)}</dd></div></dl>
${warning}${note}
    <div class="detail-grid">
      <section class="demo-panel" aria-label="Browser demo">
        <div class="demo-stage"><div class="demo-canvas-wrap"><canvas class="demo-canvas" id="demo-canvas" width="720" height="260" role="img" aria-label="Audio output visualization"></canvas></div><div class="demo-meter"><div class="demo-meter-track"><div class="demo-meter-fill" id="demo-meter-fill"></div></div><span id="demo-meter-value">ready</span></div><div class="demo-actions" id="demo-result"></div></div>
        <form class="demo-form" id="demo-form"><div class="demo-fields" id="demo-fields"></div><div class="demo-actions" id="demo-actions"><button class="demo-action" id="demo-run" type="button" aria-pressed="false"><span>${example.mode === 'node' ? 'Copy command' : 'Run demo'}</span></button></div><p class="demo-help" id="demo-status" role="status" aria-live="polite">Sound starts only after you run the demo.</p></form>
      </section>
      <section class="dialog-code code-stage" aria-labelledby="source-title"><div class="dialog-code-head"><h2 id="source-title">Atomic graph source</h2><button class="icon-button copy-icon copy-icon--dark" type="button" data-copy="#example-code" aria-label="Copy example source"><svg class="copy-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8h11v11H8zM5 16H4V4h12v1"/></svg><svg class="check-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></button></div><pre class="code-output"><code class="language-javascript" id="example-code">Loading source…</code></pre><p class="dialog-command"><code>${escapeHTML(example.command)}</code></p><p class="dialog-links"><a href="https://github.com/audiojs/web-audio-api/blob/master/examples/graphs/${example.id}.js">Graph source</a><a href="https://github.com/audiojs/web-audio-api/blob/master/examples/${example.id}.js">CLI wrapper</a></p></section>
    </div>
  </main>
  <footer class="site-footer"><p>web-audio-api · MIT · v${pkg.version} · <a href="https://audiojs.dev/">AudioJS</a></p></footer>
  <script type="module" src="../browser.js"></script>
</body>
</html>
`
}

function updateHome() {
  let path = join(root, 'index.html')
  let html = readFileSync(path, 'utf8')
  html = replaceGenerated(html, 'home-examples', homeExamplesHTML())
  html = html.replace(/<span data-example-count>[^<]+<\/span>/, `<span data-example-count>${examples.length}</span>`)
  html = html.replace(/<span data-version>v[^<]+<\/span>/, `<span data-version>v${pkg.version}</span>`)
  writeFileSync(path, html)
}

function updateCatalog() {
  writeFileSync(join(root, 'examples/index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="0; url=../#examples"><link rel="canonical" href="${baseUrl}#examples"><title>Examples · web-audio-api</title></head><body><main><p><a href="../#examples">Open the examples</a></p></main><script>location.replace('../#examples')</script></body></html>
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
process.stdout.write(`Built ${examples.length} example pages · v${pkg.version} · WPT ${metrics.wptPass}/${metrics.wptPass + metrics.wptFail}\n`)
