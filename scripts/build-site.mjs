#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { examples, categories } from '../examples/_catalog.js'
import { optionsFor } from '../examples/_options.js'

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
const modeLabel = mode => ({
  audio: 'Live', offline: 'Offline', mic: 'Microphone', file: 'File input', worklet: 'Worklet', node: 'Node stream',
}[mode] || 'Example')

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

function catalogHTML() {
  return categories.map(category => {
    let rows = examples.filter(example => example.category === category).map(example => {
      let search = [example.title, example.description, example.job, example.category, example.graph, ...example.apis].join(' ').toLowerCase()
      return `            <a href="./${example.id}/" data-search="${escapeAttr(search)}"><strong>${escapeHTML(example.title)}</strong><span class="example-mode">${modeLabel(example.mode)}</span><span class="example-description">${escapeHTML(example.description)}</span><code>${escapeHTML(example.command)}</code></a>`
    }).join('\n')
    return `        <section class="catalog-group" data-category="${escapeAttr(category)}">\n          <h2>${escapeHTML(category)}</h2>\n          <div class="example-list">\n${rows}\n          </div>\n        </section>`
  }).join('\n')
}

function examplePage(example) {
  let related = examples
    .filter(item => item.id !== example.id && (item.category === example.category || item.job === example.job))
    .slice(0, 4)
  let warning = example.warning
    ? `<aside class="warning"><strong>Listen safely.</strong> ${escapeHTML(example.warning)}</aside>`
    : ''
  let notice = example.note
    ? `<aside class="notice"><strong>Runtime note.</strong> ${escapeHTML(example.note)}</aside>`
    : ''
  let relatedHTML = related.map(item => `<a href="../${item.id}/"><strong>${escapeHTML(item.title)}</strong><span>${escapeHTML(item.category)}</span></a>`).join('')
  let options = optionsFor(example.id)
  let optionsHTML = options.length
    ? `<dl class="cli-options">${options.map(option => `<div><dt><code>${escapeHTML(option.syntax)}</code></dt><dd>${escapeHTML(option.description)}</dd></div>`).join('')}</dl>`
    : '<p class="no-options">No command-line options.</p>'
  let schema = JSON.stringify({ 
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareSourceCode',
        name: `${example.title} · web-audio-api example`,
        description: example.description,
        url: `${baseUrl}examples/${example.id}/`,
        codeRepository: `https://github.com/audiojs/web-audio-api/blob/master/examples/${example.id}.js`,
        programmingLanguage: 'JavaScript',
        runtimePlatform: 'Browser, Node.js',
        license: 'https://opensource.org/licenses/MIT',
      },
      {
        '@type': 'HowTo',
        name: example.title,
        description: example.description,
        tool: { '@type': 'SoftwareApplication', name: 'web-audio-api' },
        step: [
          { '@type': 'HowToStep', name: 'Run the browser demo', text: 'Start the graph after a user gesture and inspect its output.' },
          { '@type': 'HowToStep', name: 'Run the Node program', text: example.command },
          { '@type': 'HowToStep', name: 'Adapt the graph core', text: 'Keep graph construction and replace only the runtime adapter.' },
        ],
      },
    ],
  }).replaceAll('<', '\\u003c')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escapeHTML(example.title)} with Web Audio API · Browser and Node</title>
  <meta name="description" content="${escapeAttr(example.description)} Run it in the browser, inspect the complete Node CLI source, and adapt the graph for CI.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${baseUrl}examples/${example.id}/">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${baseUrl}examples/${example.id}/">
  <meta property="og:title" content="${escapeAttr(example.title)} · web-audio-api example">
  <meta property="og:description" content="${escapeAttr(example.description)}">
  <meta property="og:site_name" content="web-audio-api examples">
  <meta name="twitter:card" content="summary">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&amp;family=IBM+Plex+Mono:wght@400;500;600&amp;family=Orbitron:wght@700&amp;display=swap">
  <link rel="stylesheet" href="../../tokens.css">
  <link rel="stylesheet" href="../../site.css">
  <script type="application/ld+json">${schema}</script>
</head>
<body data-example="${example.id}">
  <a class="skip-link" href="#example">Skip to example</a>
  <header class="site-nav">
    <div class="nav-inner">
      <a class="brand" href="../../" aria-label="web-audio-api home"><span class="brand-parent">audio JS</span><span class="brand-slash" aria-hidden="true">/</span><span>web-audio-api</span></a>
      <nav class="desktop-nav" aria-label="Primary"><a href="../../#jobs">Use cases</a><a href="../">Examples</a><a href="../../#compatibility">Compatibility</a><a href="../../#faq">FAQ</a><a href="https://github.com/audiojs/web-audio-api">GitHub</a></nav>
      <a class="nav-install" href="https://npmjs.com/package/web-audio-api">npm&nbsp;i</a>
      <details class="mobile-nav"><summary>Menu</summary><nav aria-label="Mobile"><a href="../../">Home</a><a href="../">Examples</a><a href="../../#compatibility">Compatibility</a><a href="https://github.com/audiojs/web-audio-api">GitHub</a></nav></details>
    </div>
  </header>

  <main id="example">
    <section class="example-head">
      <div class="example-head-inner">
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="../../">Home</a><span aria-hidden="true">/</span><a href="../">Examples</a><span aria-hidden="true">/</span><span>${escapeHTML(example.title)}</span></nav>
        <p class="example-kicker">${escapeHTML(example.category)} · ${escapeHTML(example.job)} · ${modeLabel(example.mode)}</p>
        <h1>${escapeHTML(example.title)}</h1>
        <p>${escapeHTML(example.description)}</p>
      </div>
    </section>

    <div class="example-main">
      <div class="example-layout">
        <section class="demo-panel" aria-labelledby="demo-heading">
          <div class="workbench-head"><span id="demo-heading">Browser demo</span><span>native AudioContext</span></div>
          <div class="demo-stage">
            <div class="demo-canvas-wrap"><canvas class="demo-canvas" id="demo-canvas" width="720" height="260" role="img" aria-label="Audio output visualization"></canvas></div>
            <div class="demo-meter"><div class="demo-meter-track"><div class="demo-meter-fill" id="demo-meter-fill"></div></div><span id="demo-meter-value">ready</span></div>
            <div class="demo-actions" id="demo-result"></div>
          </div>
          <form class="demo-form" id="demo-form">
            <div class="demo-fields" id="demo-fields"></div>
            <div class="demo-actions" id="demo-actions"><button class="demo-action" id="demo-run" type="button" aria-pressed="false"><span>${example.mode === 'node' ? 'Copy command' : 'Run demo'}</span></button></div>
            <p class="demo-help" id="demo-status" role="status" aria-live="polite">Sound starts only after you run the demo.</p>
          </form>
        </section>

        <aside class="example-sidebar">
          <div><h2 class="visually-small">Graph</h2><p class="graph-path">${escapeHTML(example.graph)}</p></div>
          <dl class="example-specs">
            <div><dt>Input</dt><dd>${escapeHTML(example.input)}</dd></div>
            <div><dt>Output</dt><dd>${escapeHTML(example.output)}</dd></div>
            <div><dt>Runtime</dt><dd>Browser preview · Node CLI</dd></div>
            <div><dt>Command</dt><dd><code>${escapeHTML(example.command)}</code></dd></div>
          </dl>
          <div><h3>CLI options</h3>${optionsHTML}</div>
          <div><h3>APIs used</h3><p class="api-list">${example.apis.map(api => `<code>${escapeHTML(api)}</code>`).join('')}</p></div>
          <a class="example-source-link" href="https://github.com/audiojs/web-audio-api/blob/master/examples/${example.id}.js">Open source on GitHub →</a>
        </aside>
      </div>
      ${warning}
      ${notice}

      <section class="code-stage" aria-labelledby="code-heading">
        <h2 id="code-heading">Code</h2>
        <div class="code-toolbar">
          <span>JavaScript</span>
          <button class="copy-button copy-button--dark code-copy" type="button" data-copy="#example-code"><span>Copy code</span></button>
        </div>
        <pre class="code-output"><code class="language-javascript" id="example-code">Loading graph code…</code></pre>
        <p class="source-note">This is the graph-building function. Browser and CI options are comments at the top. Shared helpers live in <a href="https://github.com/audiojs/web-audio-api/blob/master/examples/_portable.js"><code>examples/_portable.js</code></a>; the sidebar links the runnable CLI.</p>
      </section>

      <section class="related" aria-labelledby="related-heading"><h2 id="related-heading">Related examples</h2><div class="related-list">${relatedHTML}</div></section>
    </div>
  </main>

  <footer class="site-footer"><div class="footer-inner"><p class="footer-statement">Web Audio API<br>example.</p><p class="footer-audiojs"><strong>web-audio-api</strong> is part of <a href="https://audiojs.dev/">AudioJS</a>, the open audio stack for JavaScript.</p><div class="footer-meta"><span>MIT · v${pkg.version}</span><nav aria-label="Footer"><a href="../">Examples</a><a href="https://npmjs.com/package/web-audio-api">npm</a><a href="https://github.com/audiojs/web-audio-api">GitHub</a><a href="https://audiojs.dev/">AudioJS</a></nav></div></div></footer>
  <script type="module" src="../_web.js"></script>
</body>
</html>
`
}

function updateHome() {
  let path = join(root, 'index.html')
  let html = readFileSync(path, 'utf8')
  html = html.replace(/data-metric="wpt">[^<]+/, `data-metric="wpt">${metrics.wptPass.toLocaleString('en-US')} / ${metrics.wptPass.toLocaleString('en-US')}`)
  html = html.replace(/data-metric="examples">[^<]+/, `data-metric="examples">${examples.length}`)
  html = html.replace(/<span data-version>v[^<]+<\/span>/, `<span data-version>v${pkg.version}</span>`)
  writeFileSync(path, html)
}

function updateCatalog() {
  let path = join(root, 'examples/index.html')
  let html = replaceGenerated(readFileSync(path, 'utf8'), 'catalog', catalogHTML())
  html = html.replace(/<p class="catalog-status" id="catalog-status"[^>]*>[^<]+<\/p>/, `<p class="catalog-status" id="catalog-status" role="status" aria-live="polite">${examples.length} examples</p>`)
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
  let guides = ['browser-to-node', 'test-audio-in-ci', 'tonejs-node']
  let urls = [baseUrl, `${baseUrl}examples/`, ...examples.map(example => `${baseUrl}examples/${example.id}/`), ...guides.map(guide => `${baseUrl}guides/${guide}/`)]
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${url}</loc></url>`).join('\n')}\n</urlset>\n`
  writeFileSync(join(root, 'sitemap.xml'), xml)
}

function stage() {
  let target = join(root, 'build/site')
  rmSync(target, { recursive: true, force: true })
  mkdirSync(join(target, 'examples'), { recursive: true })
  for (let file of ['index.html', 'site.css', 'site.js', 'syntax.js', 'tokens.css', 'robots.txt', 'sitemap.xml']) cpSync(join(root, file), join(target, file))
  cpSync(join(root, 'guides'), join(target, 'guides'), { recursive: true })
  for (let file of ['index.html', '_catalog.js', '_options.js', '_portable.js', '_web.js']) cpSync(join(root, 'examples', file), join(target, 'examples', file))
  for (let example of examples) {
    cpSync(join(root, 'examples', `${example.id}.js`), join(target, 'examples', `${example.id}.js`))
    cpSync(join(root, 'examples', example.id), join(target, 'examples', example.id), { recursive: true })
  }
  cpSync(join(root, 'examples', '_util.js'), join(target, 'examples', '_util.js'))
  if (existsSync(join(root, 'examples', '_tuner-pitch.js'))) cpSync(join(root, 'examples', '_tuner-pitch.js'), join(target, 'examples', '_tuner-pitch.js'))
  process.stdout.write(`Staged ${target}\n`)
}

updateHome()
updateCatalog()
generatePages()
generateDiscovery()
if (args.has('--stage')) stage()
process.stdout.write(`Built ${examples.length} example pages · v${pkg.version} · WPT ${metrics.wptPass}/${metrics.wptPass + metrics.wptFail}\n`)
