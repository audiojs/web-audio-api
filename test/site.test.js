import test, { is, ok, throws } from 'tst'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseHTML } from 'linkedom'
import { AudioWorkletNode, OfflineAudioContext } from '../index.js'
import { examples } from '../examples/catalog.js'
import { controlsFor, exampleOptions, optionsFor } from '../examples/options.js'
import { buildGraph, buildProcessedBuffer, graphBuilders, stopGraph } from '../examples/graphs/index.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = path => readFileSync(join(root, path), 'utf8')
const pkg = JSON.parse(read('package.json'))
const examplePages = ['examples/index.html', ...examples.map(example => `examples/${example.id}/index.html`)]
const htmlFiles = ['index.html', ...examplePages]

function documentOf(path) {
  return parseHTML(read(path)).document
}

function localTarget(path, href) {
  let clean = href.split('#')[0].split('?')[0]
  if (!clean || /^(?:[a-z]+:|\/\/)/i.test(clean)) return null
  let target = resolve(root, dirname(path), clean)
  if (clean.endsWith('/')) target = join(target, 'index.html')
  else if (!extname(target) && existsSync(join(target, 'index.html'))) target = join(target, 'index.html')
  return target
}

test('catalog covers every CLI and portable graph module exactly once', () => {
  is(examples.length, 46)
  is(new Set(examples.map(example => example.id)).size, examples.length)
  let sourceIds = readdirSync(join(root, 'examples'), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.js') && !['browser.js', 'catalog.js', 'options.js', 'tuner-pitch.js', 'utils.js'].includes(entry.name))
    .map(entry => entry.name.slice(0, -3))
    .sort()
  is(sourceIds.join(','), examples.map(example => example.id).sort().join(','))
  let jobCounts = new Map()
  for (let example of examples) jobCounts.set(example.job, (jobCounts.get(example.job) || 0) + 1)
  for (let [job, count] of jobCounts) ok(count >= 2, `${job} tags at least two examples (${count})`)
  for (let example of examples) {
    ok(existsSync(join(root, 'examples', `${example.id}.js`)), `${example.id} CLI`)
    ok(existsSync(join(root, 'examples', 'graphs', `${example.id}.js`)), `${example.id} graph`)
    ok(existsSync(join(root, 'examples', example.id, 'index.html')), `${example.id} compatibility route`)
    ok(example.command.startsWith('npx web-audio-api '), `${example.id} command`)
  }
})

test('homepage is only the hero, example catalogue, compact FAQ, and footer', () => {
  let document = documentOf('index.html')
  is(document.querySelector('#hero-title strong').textContent.replace(/\s/g, ' '), 'Web Audio API')
  // the phrase under the title is copy in flux; about 21 characters hold one line in the hero column
  let subtitle = document.querySelector('#hero-title span').textContent
  ok(subtitle.length > 4 && subtitle.length <= 26, `the title's second phrase stays short: ${subtitle}`)
  let lede = document.querySelector('.hero-intro').textContent
  let jobs = ['CI', 'server', 'Tone.js', 'CLI', 'batch', 'render', 'decode', 'test', 'headless', 'PCM', 'process'].filter(job => lede.toLowerCase().includes(job.toLowerCase()))
  ok(jobs.length >= 3, `lede states concrete jobs (${jobs.join(', ') || 'none'})`)
  ok(document.querySelectorAll('.faq a[href="https://github.com/audiojs/speaker"]').length >= 2, 'the FAQ discloses the speaker adapter the claims lean on')
  is(document.querySelectorAll('.hero-stack').length, 1, 'one engine row')
  let marks = [...document.querySelectorAll('.hero-stack > button')]
  let tipOf = mark => document.getElementById(mark.getAttribute('aria-describedby'))
  is(marks.filter(mark => !mark.classList.contains('is-wip')).map(mark => mark.textContent.trim()).join('|'), 'Node|Deno|Bun|LLRT', 'passing engines ride the intro')
  let coming = marks.filter(mark => mark.classList.contains('is-wip'))
  is(coming.map(mark => mark.textContent.trim()).join('|'), 'Porffor|JZ', 'runtimes in the works ride along, dimmed and named')
  ok(marks.every(mark => mark.getAttribute('type') === 'button' && tipOf(mark)?.getAttribute('popover') === 'manual' && tipOf(mark).getAttribute('role') === 'tooltip' && tipOf(mark).textContent.length > 20 && mark.querySelector('img').alt === ''), 'every runtime carries a popover tip saying what is verified there; its mark is decorative')
  ok(coming.every(mark => /work in progress/i.test(tipOf(mark).textContent)) && read('.github/workflows/porffor.yml').includes('Porffor cannot run the engine yet'), 'each says so in its tip, and Porffor stays tracking-only in CI')
  ok(!document.querySelector('.site-footer .wpt-badge'), 'no badge in the footer')
  ok(read('.github/workflows/wpt.yml').includes('name: W3C WPT'), 'the dedicated WPT workflow names the badge')
  ok(!document.querySelector('.hero-spec img'), 'spec plate carries no badge image')
  is(document.querySelectorAll('header a').length, 5, 'brand, examples, FAQ, version, and GitHub')
  is([...document.querySelectorAll('header nav a')].map(node => `${node.textContent}=${node.getAttribute('href')}`).join('|'), 'Examples=./examples/|FAQ=#faq', 'the navigation leads to the catalogue and the questions')
  ok(document.querySelector('header a.brand[href="./"] svg path[d^="M21.25 41.75"]'), 'the site seal leads home')
  ok(document.querySelector('header a.version-link[href="https://www.npmjs.com/package/web-audio-api"] [data-version]'), 'the version links to npm')
  ok(document.querySelector('header a[href="https://github.com/audiojs/web-audio-api"]'))
  is(document.querySelectorAll('header nav').length, 1, 'one primary navigation')
  is(document.querySelector('.install-command code').textContent.trim(), 'npm install web-audio-api')
  is(document.querySelectorAll('.install-command button').length, 0, 'install command has no copy button')
  ok(!document.body.textContent.includes('Basic usage'))
  ok(/^\d{2,3} KB gzipped$/.test(document.querySelector('.hero-spec a[href="https://packagephobia.com/result?p=web-audio-api"][data-pack-size]').textContent), 'packed size leads to packagephobia')
  is(document.querySelector('.site-footer a[href="https://github.com/audiojs/web-audio-api/blob/master/LICENSE"]').textContent, 'MIT', 'MIT leads to the license')
  ok(document.querySelector('.site-footer a[href="https://github.com/krishnized/license"]'), 'krishnized dedication rides the footer')
  ok(document.querySelector('.site-footer').textContent.includes('2013'), 'footer carries since 2013')
  ok(document.querySelector('.site-footer .footer-brand[href="https://audiojs.dev/"] svg path[d^="M28.6572"]'), 'footer carries the audiojs org mark')
  is(document.querySelector('.hero-spec a[href="https://github.com/audiojs/web-audio-api/actions/workflows/wpt.yml"]').textContent, 'W3C WPT 100%', 'the WPT claim rides the spec plate as plain text')
  ok(document.querySelector('.site-footer a[href="https://github.com/sponsors/audiojs"]'), 'footer invites support')
  ok(document.querySelector('.site-footer a[href="https://github.com/sebpiq"]') && document.querySelector('.site-footer a[href="https://github.com/dy"]'), 'authors are credited with links')
  ok(!document.querySelector('.hero-code [data-copy]'), 'the hero code has no copy button')
  is([...document.querySelectorAll('main > section > .section-heading h2')].map(node => node.textContent).join('|'), 'Examples|FAQ', 'both sections announce themselves')
  ok(read('examples/browser.js').includes("querySelector('.example-tag')"), 'the filter reads the tag element the entries actually render')
  ok(!document.querySelector('[data-example-count]'), 'no static graph count')
  ok(document.querySelector('.faq table.bench'), 'realtime answer carries measured numbers')
  let runtimes = [...document.querySelectorAll('[aria-label="Runtime support"] tbody tr')]
  ok(runtimes.length && runtimes.every(row => row.querySelector('th .runtime-mark')), 'every runtime in the table wears its mark')
  is(document.querySelector('.comparison tbody tr th').textContent, 'Engine', 'alternatives table lists aspects as rows, packages as columns')
  ok(document.querySelector('.install-row > .install-command + .hero-spec'), 'the figures follow the command, outside its plate')
  let featured = [...document.querySelectorAll('[data-open-example]')]
  is(featured.length, 10, 'the homepage leads with a few examples')
  ok(featured.every(link => examples.some(example => example.id === link.dataset.openExample)), 'each featured example is in the catalogue')
  ok(featured.every(link => link.getAttribute('href') === `./examples/${link.dataset.openExample}/` && link.querySelector('.example-thumb')), 'each featured entry is a crawlable link with its render')
  ok(featured.every(link => !link.querySelector('.example-number')), 'a selection carries no catalogue numbers')
  ok(!document.querySelector('.example-group'), 'the categories live on the catalogue page')
  ok(!document.querySelector('.examples .section-heading p'), 'the catalogue speaks for itself')
  let all = document.querySelector('.examples .section-heading .example-all')
  is(all.textContent, `All ${examples.length} examples`, 'the heading offers every one of them')
  is(all.getAttribute('href'), './examples/', 'pointing at the catalogue page')
  // the examples sit on a white field the stripe band above them dissolves the paper into
  for (let path of ['index.html', 'examples/index.html']) {
    let page = documentOf(path)
    let band = page.querySelector('canvas.field-strips')
    ok(band && band.nextElementSibling.tagName === 'MAIN', `${path}: the band stands above the field, outside the page's measure`)
  }
  ok(read('examples/browser.js').includes("stripBand(fieldStrips, false, '--color-white')") && !read('site.js').includes('stripBand'), 'one module paints every band')
  ok(/\.examples \{[^}]*background: var\(--color-white\)[^}]*clip-path: inset\(0 -100vmax 0\)/s.test(read('assets/site.css')), 'the field runs white to the edges and stops at its own bounds')
  let dialog = document.querySelector('dialog#example-dialog')
  ok(dialog)
  ok(dialog.querySelector('.dialog-body > :first-child').classList.contains('demo-panel'), 'demo precedes source')
  is(dialog.querySelectorAll('.dialog-code-head, .dialog-links, .code-output [data-copy]').length, 0, 'code view has no redundant chrome')
  is([...dialog.querySelectorAll('.code-tab')].map(tab => tab.dataset.pane).join('|'), 'graph|cli|code', 'source panel opens on the graph, then the CLI and the code')
  ok(dialog.querySelector('.code-tab[data-pane="graph"][aria-pressed="true"]'), 'the graph is the default view')
  ok(dialog.querySelector('.cli-command [data-copy="#cli-command"]'), 'CLI command is copyable')
  ok(dialog.querySelector('.code-output[hidden]'), 'code stays hidden until requested')
  ok(dialog.querySelector('#demo-spectrogram'), 'demo includes a spectrogram')
  ok(dialog.querySelector('.demo-spectrogram-wrap #demo-frequency-scale'), 'scale selector overlays the spectrogram')
  is(dialog.querySelectorAll('#demo-frequency-scale option').length, 3, 'linear, mel, and log scales are available')
  ok(dialog.querySelector('.demo-runbar #demo-run .play-glyph'), 'run action is a play control in the playback row')
  ok(dialog.querySelector('.demo-runbar #demo-volume'), 'output volume rides the runbar')
  ok(!dialog.querySelector('.detail-seo'), 'SEO text never rides the modal')
  is(document.querySelectorAll('[role="tab"]').length, 0)
  let questions = [...document.querySelectorAll('.faq summary')].map(node => node.textContent.trim())
  for (let expected of ['Is it fast enough for realtime?', 'How do speakers and mics work?', 'Which formats can it decode?', 'How heavy is it?', 'Do Tone.js and other libraries work?', 'How do I test audio in CI?', 'Can it run without speakers?', 'Does it support AudioWorklets?', 'Where does it run?', 'What differs from a browser?', 'How does it compare to alternatives?']) ok(questions.includes(expected), expected)
})

test('every CLI option schema matches its source and --help output', () => {
  is(Object.keys(exampleOptions).sort().join(','), examples.map(example => example.id).sort().join(','))
  for (let example of examples) {
    let source = read(`examples/${example.id}.js`)
    let block = source.match(/\n\s*options:\s*(\[[\s\S]*?\]),\n\s*(?:controls:|notes:|\}\))/)?.[1]
    let documented = block ? [...block.matchAll(/\[\s*(['"`])(.+?)\1\s*,/g)].map(match => match[2]) : []
    let schema = optionsFor(example.id).map(option => option.syntax)
    is(schema.join('|'), documented.join('|'), `${example.id}: schema and CLI source`)
    ok(!controlsFor(example.id).some(control => control.type === 'file'), `${example.id}: no file control in the browser; files stay a CLI option`)
    if (!/(?:^|[/\\])deno(?:\.exe)?$/.test(process.execPath)) {
      let output = execFileSync(process.execPath, [`examples/${example.id}.js`, '--help'], { cwd: root, encoding: 'utf8' })
      let section = output.match(/\nOptions:\n([\s\S]*?)(?=\n\n(?:Controls:|Note:| {2}-h, --help))/)?.[1]
      let cli = section ? section.trim().split('\n').map(line => line.trim().split(/\s{2,}/)[0]) : []
      is(schema.join('|'), cli.join('|'), `${example.id}: schema and --help`)
    }
    is(new Set(controlsFor(example.id).map(control => control.key)).size, controlsFor(example.id).length, `${example.id}: unique browser controls`)
  }
})

test('package, decoder, README, and homepage agree', () => {
  is(pkg.homepage, 'https://audiojs.dev/web-audio-api/')
  ok(pkg.dependencies['@audio/decode'], 'direct @audio/decode dependency')
  ok(pkg.dependencies['@audio/speaker'], 'scoped speaker dependency')
  ok(pkg.peerDependencies['@audio/mic'], 'scoped optional microphone peer')
  ok(!pkg.dependencies['audio-decode'], 'unscoped decoder alias removed')
  ok(!pkg.dependencies['audio-speaker'], 'unscoped speaker alias removed')
  ok(!pkg.peerDependencies['audio-mic'], 'unscoped microphone alias removed')
  ok(read('src/utils.js').includes("from '@audio/decode'"))
  ok(read('src/AudioContext.js').includes("from '@audio/speaker'"))
  ok(read('polyfill.js').includes("import('@audio/mic')"))
  ok(read('README.md').includes(`](${pkg.homepage})`), 'README links to homepage')
  ok(read('README.md').split('\n')[0].includes('assets/logo.svg') && existsSync(join(root, 'assets/logo.svg')), 'the seal leads the README title')
  is(documentOf('index.html').querySelector('link[rel="canonical"]').href, pkg.homepage)
  let sitemap = read('sitemap.xml')
  is((sitemap.match(/<url>/g) || []).length, examples.length + 2, 'homepage, catalogue, and every example are indexed')
  ok(sitemap.includes(`<loc>${pkg.homepage}examples/</loc>`), 'the catalogue page is indexed')
  ok(read('llms.txt').includes(`- [All examples](${pkg.homepage}examples/)`), 'and named for machines reading llms.txt')
  for (let example of examples) ok(sitemap.includes(`${pkg.homepage}examples/${example.id}/`), `${example.id} sitemap URL`)
})

test('homepage and example pages share the AudioJS favicon', () => {
  let homeIcons = documentOf('index.html').querySelectorAll('link[rel="icon"]')
  is(homeIcons.length, 1, 'homepage: one favicon')
  let homeIcon = homeIcons[0]
  is(homeIcon.type, 'image/svg+xml')
  ok(homeIcon.getAttribute('href').startsWith('data:image/svg+xml,'))
  for (let path of examplePages.slice(1)) {
    ok(documentOf(path).querySelector('header.corner-action .header-strips') && documentOf(path).querySelector('link[rel="preload"][as="font"][href$="jetbrains-mono-latin.woff2"]'), `${path}: the homepage's header and fonts`)
    let icons = documentOf(path).querySelectorAll('link[rel="icon"]')
    is(icons.length, 1, `${path}: one favicon`)
    is(icons[0].type, homeIcon.type, `${path}: favicon type`)
    is(icons[0].getAttribute('href'), homeIcon.getAttribute('href'), `${path}: favicon source`)
  }
})

test('every page carries a social card, theme colour, and touch icon; 404 wears the chrome', () => {
  let og = documentOf('index.html').querySelector('meta[property="og:image"]').content
  ok(og.startsWith(pkg.homepage) && og.endsWith('.png'), 'homepage og:image is an absolute PNG URL')
  ok(existsSync(join(root, og.slice(pkg.homepage.length))), 'og:image file exists')
  for (let path of ['index.html', '404.html', ...examplePages.slice(1)]) {
    let doc = documentOf(path)
    is(doc.querySelector('meta[property="og:image"]')?.content, og, `${path}: og:image`)
    is(doc.querySelector('meta[name="twitter:card"]')?.content, 'summary_large_image', `${path}: twitter card`)
    ok(doc.querySelector('meta[name="theme-color"]')?.content, `${path}: theme-color`)
    let touch = doc.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href')
    if (touch?.startsWith('/')) touch = './' + touch.slice(new URL(pkg.homepage).pathname.length)
    ok(touch && existsSync(localTarget(path, touch)), `${path}: apple-touch-icon`)
    ok(!doc.querySelector('link[href*="fonts.googleapis.com"]'), `${path}: fonts are self-hosted`)
  }
  let notFound = documentOf('404.html')
  ok(notFound.querySelector('header.corner-action') && notFound.querySelector('footer.site-footer'), '404 borrows the chrome')
  is(notFound.querySelector('meta[name="robots"]')?.content, 'noindex', '404 is not indexed')
  ok(notFound.querySelector(`a[href="${new URL(pkg.homepage).pathname}examples/"]`), '404 points at the examples')
})

test('every example has a crawlable canonical detail page', () => {
  let catalogue = documentOf('examples/index.html')
  ok(!catalogue.querySelector('meta[http-equiv="refresh"]'), 'the catalogue is a page of its own, not a redirect')
  is(catalogue.querySelector('link[rel="canonical"]').href, `${pkg.homepage}examples/`)
  ok(catalogue.querySelector('header.corner-action .header-strips') && catalogue.querySelector('.site-footer .footer-brand'), 'it wears the homepage chrome')
  ok(catalogue.querySelector('.section-heading #example-filters[role="group"]'), 'examples are filterable by tag')
  is([...catalogue.querySelectorAll('.example-group h3')].map(node => node.textContent).join('|'), 'Utilities|Test signals|Illusions|Synthesis|Generative|API', 'groups run by search demand')
  let links = [...catalogue.querySelectorAll('.example-entry')]
  is(links.length, examples.length, 'every example is listed')
  for (let [index, example] of examples.entries()) {
    let link = links[index]
    is(link.getAttribute('href'), `./${example.id}/`, `${example.id}: catalogue order and route`)
    is(link.querySelector('.example-number').textContent, String(index + 1).padStart(2, '0'), `${example.id}: catalogue number`)
    is(link.querySelector('.example-heading strong').textContent, example.title, `${example.id}: title`)
    is(link.querySelector('.example-description + .example-tag').textContent, example.job, `${example.id}: job tag closes the entry`)
    is(link.querySelector('.example-description').textContent, example.description, `${example.id}: description`)
    ok(link.querySelector('.example-arrow'), `${example.id}: open arrow`)
    ok(!link.dataset.openExample, `${example.id}: the catalogue links, it does not open the modal`)
  }
  for (let example of examples) {
    let path = `examples/${example.id}/index.html`
    let document = documentOf(path)
    ok(!document.querySelector('meta[http-equiv="refresh"]'), `${example.id} does not redirect`)
    is(document.body.dataset.example, example.id, `${example.id} page identity`)
    is(document.querySelector('link[rel="canonical"]').href, `${pkg.homepage}examples/${example.id}/`)
    is(document.querySelector('h1').textContent, example.title)
    ok(document.querySelector('#demo-form'), `${example.id} browser adapter`)
    ok(document.querySelector('#example-code'), `${example.id} atomic source`)
    ok(document.querySelector('.detail-grid > :first-child').classList.contains('demo-panel'), `${example.id} demo precedes source`)
    let crumbs = [...document.querySelectorAll('.detail-crumbs a')]
    is(crumbs.map(link => link.getAttribute('href')).join(' '), `../ ../#${example.category.toLowerCase().replace(/\s+/g, '-')}`, `${example.id} breadcrumbs lead back into the catalogue`)
    is(document.querySelectorAll('.dialog-code-head, .dialog-links, .code-output [data-copy]').length, 0, `${example.id} code chrome removed`)
    is(document.querySelector('#cli-command').textContent, example.command, `${example.id} CLI command`)
    is(document.querySelectorAll('.cli-options dt').length, optionsFor(example.id).length, `${example.id} CLI options documented`)
    ok(document.querySelector('.code-tab[data-pane="graph"][aria-pressed="true"]'), `${example.id} graph view default`)
    ok(document.querySelector('#demo-spectrogram'), `${example.id} spectrogram`)
    ok(document.querySelector('.demo-runbar #demo-run .play-glyph'), `${example.id} separate run footer`)
    ok(document.querySelector('script[type="application/ld+json"]'), `${example.id} structured data`)
    ok(document.querySelector('.corner-action .brand[href="../../"]'), `${example.id} logo leads home`)
    is(document.querySelector('.corner-action nav a').getAttribute('href'), '../../examples/', `${example.id} the nav leads to the catalogue, not the homepage anchor`)
    is(!!document.querySelector('.detail-seo'), !!example.seo, `${example.id} SEO text on its own page`)
    ok(document.querySelector('.code-tab[data-pane="graph"]') && document.querySelector('#graph-pane.dots'), `${example.id} graph tab, as in the modal`)
    ok(document.querySelector('.corner-action .header-strips') && document.querySelector('canvas.footer-strips + .site-footer .footer-brand'), `${example.id} borrows the homepage chrome, both stripe bands included`)
    ok(!document.querySelector('.detail-related') || document.querySelector('.detail-related .example-thumb'), `${example.id} related entries carry their renders`)
    ok(!document.querySelector('.detail-related h2') || document.querySelector('.detail-related h2').textContent === 'Other examples', `${example.id} related heading`)
    ok(!document.querySelector('.detail-facts'), `${example.id} carries no restated facts`)
    let callouts = document.querySelectorAll('.callout')
    is(callouts.length, example.warning || example.note ? 1 : 0, `${example.id} one callout at most`)
    if (callouts.length) ok(callouts[0].previousElementSibling.classList.contains('detail-grid') && callouts[0].querySelector('.callout-label').textContent === (example.warning ? 'Warning' : 'Note'), `${example.id} callout follows the stage`)
  }
})

test('hero.js connects a feedback graph and renders a pluck that decays', async () => {
  let { runHero } = await import('../scripts/render.mjs')
  let { audio, nodes, edges } = await runHero(read('hero.js'), 3)
  let names = edge => `${edge.from.constructor.name}>${edge.to.constructor.name}`
  is(nodes.map(node => node.constructor.name).join(','), 'AudioBufferSourceNode,DelayNode,BiquadFilterNode,GainNode,AudioDestinationNode', 'the graph is the string')
  ok(edges.map(names).includes('GainNode>DelayNode'), 'feedback closes the loop')
  ok(edges.map(names).includes('DelayNode>AudioDestinationNode'), 'the string reaches the output')
  let data = audio.getChannelData(0)
  let level = (from, to) => Math.sqrt(data.slice(from * audio.sampleRate, to * audio.sampleRate).reduce((sum, sample) => sum + sample * sample, 0) / ((to - from) * audio.sampleRate))
  ok(data.every(Number.isFinite), 'finite')
  ok(data.reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0) <= 1, 'the loop never grows past the click')
  ok(level(0.25, 0.75) > 1e-3, 'the string rings')
  ok(level(2.25, 2.75) < level(0.25, 0.75) / 4, 'and decays: a lowpass with resonance would make the loop grow')
})

test('the graph recorder runs a source twice, resolves AudioParam targets, and draws loops and parameters', async () => {
  let { runHero } = await import('../scripts/render.mjs')
  let { graphSVG, recordConnections, resolveGraph } = await import('../graph.js')
  let hero = await runHero(read('hero.js'), 0.1)
  is(hero.nodes.length, 5, 'the same source records again in the same process')
  let drawn = graphSVG(hero.nodes, hero.edges)
  is((drawn.match(/class="node"/g) || []).length, 5, 'one box per node')
  is((drawn.match(/class="edge back"/g) || []).length, 1, 'the feedback loop is a back edge')
  let marker = drawn.match(/<marker id="([^"]+)"/)[1]
  ok(marker !== graphSVG(hero.nodes, hero.edges).match(/<marker id="([^"]+)"/)[1] && drawn.split(`url(#${marker})`).length === 6, 'each drawing owns its arrowhead, on all five edges')
  let shade = drawn.match(/<filter id="([^"]+)"/)[1]
  ok(drawn.includes('<feDropShadow') && drawn.split(`filter="url(#${shade})"`).length === 6, 'and its shadow, under all five cards')
  let { collapseGraph } = await import('../graph.js')
  let voices = new OfflineAudioContext(1, 1, 44100)
  let chorus = await recordConnections(Object.getPrototypeOf(Object.getPrototypeOf(voices.createGain())), () => {
    for (let i = 0; i < 3; i++) voices.createOscillator().connect(voices.createGain()).connect(voices.destination)
  })
  let full = resolveGraph(chorus), folded = collapseGraph(full.nodes, full.edges)
  is(`${full.nodes.length}>${folded.nodes.length}`, '7>3', 'three voices fold into one voice')
  is(folded.nodes.map(node => `${node.constructor.name}×${folded.counts.get(node)}`).join(','), 'OscillatorNode×3,GainNode×3,AudioDestinationNode×1', 'each box keeps its count')
  is(folded.edges.length, 2, 'and the edges fold with them')
  ok(graphSVG(folded.nodes, folded.edges, 'chorus', folded.counts).includes('>3 nodes<'), 'the count is drawn as a count of nodes')
  let heroFolded = collapseGraph(hero.nodes, hero.edges)
  is(`${heroFolded.nodes.length},${heroFolded.edges.length},${Math.max(...heroFolded.counts.values())}`, '5,5,1', 'distinct roles never fold')
  is(collapseGraph([], []).nodes.length, 0, 'nothing folds to nothing')
  let proto = new OfflineAudioContext(1, 1, 44100).createGain()
  while (!Object.hasOwn(proto, 'connect')) proto = Object.getPrototypeOf(proto)
  let connect = proto.connect, failed = null
  await recordConnections(proto, () => { throw new Error('mid-run') }).catch(error => failed = error)
  is(failed?.message, 'mid-run', 'a failing run still throws')
  is(proto.connect, connect, 'and leaves connect() as it was')
  let { nodes, edges } = await runHero([
    "import { AudioContext } from 'web-audio-api'",
    'const ctx = new AudioContext()',
    'const lfo = ctx.createOscillator(), tremolo = ctx.createGain(), orphan = ctx.createGain()',
    'lfo.connect(tremolo.gain)',
    'lfo.connect(orphan.gain)',
    'tremolo.connect(ctx.destination)',
    'lfo.start()',
  ].join('\n'), 0.1)
  let describe = edge => `${edge.from.constructor.name}>${edge.to.constructor.name}${edge.param ? '.' + edge.param : ''}`
  is(edges.map(describe).join(','), 'OscillatorNode>GainNode.gain,OscillatorNode>AudioParam,GainNode>AudioDestinationNode', 'a parameter of a connected node resolves to that node; one of an unconnected node stays a parameter')
  is(nodes.map(node => node.constructor.name).join(','), 'OscillatorNode,GainNode,AudioDestinationNode,AudioParam')
  ok(graphSVG(nodes, edges).includes('>.gain<'), 'parameter edges are labeled')
})

test('the homepage wires the hero play, the graph tab, and the page-side Web Audio', () => {
  let document = documentOf('index.html')
  let play = document.querySelector('.hero-code [data-run="./hero.js"]')
  ok(play?.querySelector('.play-glyph') && play.querySelector('.pause-glyph'), 'one play button with both glyphs')
  ok(!document.querySelector('.hero-code [data-copy]'), 'no copy control on the hero code')
  ok(document.querySelector('.install-row > .install-command + .hero-spec') && !document.querySelector('.install-row [data-copy]'), 'the install row is the command and its figures, nothing to press')
  is([...document.querySelectorAll('.site-footer .footer-specs > *')].map(node => node.textContent.trim().split(/[\s,]/)[0].toLowerCase()).join(','), 'since,sponsor', 'the right column runs since, then sponsor and licence')
  ok(document.querySelector('.site-footer .footer-specs span:last-child > a[href="https://github.com/sponsors/audiojs"] + a[href$="/LICENSE"]'), 'sponsor leads the licence line at the right')
  for (let file of ['assets/site.css', 'graph.js', 'site.js']) ok(!/#[0-9a-f]{3,8}\b|\b(?:rgb|hsl|oklch|oklab)\(/i.test(read(file).replace(/url\(#[\w-]+\)/g, '')), `${file} takes every color from a token`)
  ok(document.querySelector('.hero-art .graph') && document.querySelector('.hero-signal .hero-spectrum'), 'the graph rides the hero, the render rides the code')
  let wave = document.querySelector('.hero-signal .hero-wave'), spectrum = document.querySelector('.hero-signal .hero-spectrum')
  let grid = path => [...path.getAttribute('d').matchAll(/M([\d.]+) /g)].map(match => match[1]).join()
  is(wave.getAttribute('viewBox'), spectrum.getAttribute('viewBox'), 'wave and spectrum share one box')
  is(grid(wave.querySelector('.wave-peak')), grid(spectrum.querySelector('path')), 'wave and spectrum share one bar grid')
  is(grid(wave.querySelector('.wave-rms')), grid(wave.querySelector('.wave-peak')), 'both envelopes sit on it')
  is(wave.getAttribute('preserveAspectRatio') + spectrum.getAttribute('preserveAspectRatio'), 'nonenone', 'both fill whatever height the layout gives them')
  let zero = path => Math.min(...[...path.getAttribute('d').matchAll(/ ([\d.]+)V([\d.]+)/g)].map(m => Math.abs(m[2] - m[1])))
  is(zero(spectrum.querySelector('path')), 1, 'a silent bin is a one-unit dot')
  ok(zero(wave.querySelector('.wave-peak')) >= 1, 'no wave bin is drawn thinner than that dot')
  ok(read('site.js').includes('} 220V${(220 - Math.max(1, ') && read('site.js').includes('Math.max(0.5, level(v) * 106)'), 'the live panel keeps the same box and dot')
  ok(read('site.js').includes('new Float32Array(100), levels = new Float32Array(100), bins = new Float32Array(100)') && read('site.js').includes('M${2 + i * 4} '), 'the live panel draws on the same grid')
  let map = JSON.parse(document.querySelector('script[type="importmap"]').textContent)
  let shim = decodeURIComponent(map.imports['web-audio-api'])
  ok(map.imports['web-audio-api'].startsWith('data:text/javascript,') && shim.includes('extends globalThis.AudioContext') && shim.includes('AnalyserNode'), 'the package name resolves to the page\'s own context, tapped for the live panel')
  ok(shim.includes('AudioNode.prototype.connect') && shim.includes('nodes ??= new Set()'), 'whatever connects stays alive with its context: Chrome collects unreferenced nodes mid-sound')
  ok(document.querySelector('#example-dialog .code-tab[data-pane="graph"]') && document.querySelector('#example-dialog #graph-pane[hidden]'), 'the modal offers a graph tab, hidden until chosen')
  ok(document.querySelector('#example-dialog .demo-panel > .demo-bar:first-child .demo-runbar #demo-run') && document.querySelector('#example-dialog .demo-bar #demo-status'), 'play, volume, and the meter head the demo column')
  ok((read('assets/site.css').match(/min-height: var\(--toolbar\)/g) || []).length === 2, 'the playback row and the tab row share one height')
  ok(/\.dialog-code \{[^}]*contain: size/.test(read('assets/site.css')) && /\.dialog-code \.code-output,\n\.dialog-code \.cli-pane \{[^}]*overflow-y: auto/.test(read('assets/site.css')), 'the source column never sizes the modal; its panes scroll inside')
  ok(document.querySelector('#example-dialog #graph-pane.dots'), 'the graph pane carries the blueprint dots')
  ok(read('scripts/build-site.mjs').includes("cpSync(join(root, 'assets')") && read('.github/workflows/pages.yml').includes("'assets/**'"), 'the stylesheets ship from assets and changes there deploy')
  let clicks = [...documentOf('examples/index.html').querySelector('.example-entry[href="./metronome/"] .example-thumb path').getAttribute('d').matchAll(/M[\d.]+ [\d.]+(L|h\.01)/g)].map(match => match[1] === 'L' ? 'bar' : 'dot')
  is(clicks.join(' '), Array.from({ length: 16 }, (_, k) => k % 4 ? 'dot' : 'bar').join(' '), 'the metronome thumb is a bar every fourth column')
  ok(/@media \(40rem <= width <= 64rem\) \{[^@]*\.example-grid > :nth-child\(even\)/.test(read('assets/site.css')), 'the two-column catalogue tweaks stay inside their range, never on phones')
  let site = read('site.js'), shared = read('examples/browser.js')
  for (let hook of ["'audiocontext'", 'data-run', 'getFloatTimeDomainData', 'new URL(`examples/${id}/`, homeURL)', "classList.add('is-compact')", 'new ResizeObserver']) ok(site.includes(hook), `site.js carries ${hook}`)
  ok(read('assets/site.css').includes('.hero-stack.is-fitted { flex-wrap: nowrap; }'), 'the runtime row goes to one line only once the script fits it')
  for (let hook of ['graph-pane', 'recordConnections', 'collapseGraph', "'wheel'", 'highlightSyntax(', "highlights.set('method'", "querySelectorAll('.header-strips')", "querySelectorAll('.footer-strips')"]) ok(shared.includes(hook), `browser.js carries ${hook} for every page`)
  ok(read('assets/site.css').includes('.example-tag,\n.example-filters button {') && read('assets/site.css').includes('.code-tab[aria-pressed="true"] {\n  border-block-end-color'), 'tags and filters share one pill rule; tabs underline')
  ok(read('assets/site.css').includes('::highlight(method)') && read('assets/tokens.css').includes('--syntax-method'), 'methods have their own highlight and token')
  let browser = read('examples/browser.js')
  for (let hook of ["remember(frequencyScale, 'demo-frequency-scale')", "remember(volume, 'demo-volume')", 'if (!data) return']) ok(browser.includes(hook), `the demo ${hook.startsWith('remember') ? 'remembers ' + hook.slice(9, -1) : 'draws only the axis before it plays'}`)
  ok(browser.includes('drawWaveColumn(canvas, samples)') && (browser.match(/columnStep\(\)/g) || []).length === 3, 'the live envelope and the spectrogram advance one shared column per frame')
})

test('thumbnail projections put a known signal where it belongs on the lattice', async () => {
  let { draw } = await import('../scripts/render.mjs')
  let rate = 44100
  let buffer = (fill, seconds = 2) => {
    let length = rate * seconds
    let audio = new OfflineAudioContext(2, length, rate).createBuffer(2, length, rate)
    for (let c = 0; c < 2; c++) { let data = audio.getChannelData(c); for (let i = 0; i < length; i++) data[i] = fill(i / rate, c) }
    return audio
  }
  let silence = buffer(() => 0)
  let tone = buffer(t => 0.5 * Math.sin(2 * Math.PI * 440 * t))
  let leftOnly = buffer((t, c) => c ? 0 : 0.5 * Math.sin(2 * Math.PI * 440 * t))
  for (let kind of Object.keys(draw)) ok(draw[kind](tone).every(segment => segment.every(value => value >= 0 && value <= 96)), `${kind} stays inside the box`)
  let ends = segments => segments.flatMap(([, y1, , y2]) => [y1, y2])
  is(draw.wave(silence).length, 16, 'silence is one mark per column')
  ok(ends(draw.wave(silence)).every(y => y === 48), 'a dot on the axis')
  ok(draw.wave(tone).length === 16 && draw.wave(tone).every(([, y1, , y2]) => y1 === 6 && y2 === 90), 'a steady tone is a full bar in every column')
  ok(ends(draw.wave(leftOnly)).every(y => y <= 48), 'a left-only signal stays above the axis')
  is(draw.roll(tone).length, 16, 'a tone is one dash per column')
  ok(ends(draw.roll(tone)).every(y => y === 48), 'a lone pitch sits on the axis: the range fits the notes')
  let twoTones = buffer(t => 0.5 * Math.sin(2 * Math.PI * (t < 1 ? 440 : 880) * t))
  is(ends(draw.roll(twoTones)).map(y => y === 90 ? 'low' : y === 6 ? 'high' : y).join(','), Array(8).fill('low,low').concat(Array(8).fill('high,high')).join(','), 'two pitches span the rails, low first')
  let heights = draw.spectrum(tone).map(([, y1, , y2]) => Math.abs(y1 - y2))
  is(heights.indexOf(Math.max(...heights)), Math.floor(Math.log(440 / 40) / Math.log(400) * 16), 'the spectrum peaks in the bin of its frequency')
  ok(draw.shape(tone).length === 16 && draw.shape(tone).every(([, y1, , y2]) => y1 === 48 || y2 === 48), 'the waveform touches the axis in every column')
  ok(ends(draw.shape(tone)).some(y => y === 6 || y === 90), 'and reaches a rail')
  is(JSON.stringify(draw.wave(tone)), JSON.stringify(draw.wave(tone)), 'drawing is deterministic')
  is(draw.roll(silence).length + draw.ears(silence).length + draw.pan(silence).length + draw.raster(silence).length, 0, 'silence draws nothing on the pitch, ear, pan, and onset projections')
  let split = buffer((t, c) => 0.5 * Math.sin(2 * Math.PI * (c ? 880 : 440) * t))
  is(draw.ears(split).map(([, y]) => y === 42 ? 'L' : y === 54 ? 'R' : y).join(''), 'L'.repeat(16) + 'R'.repeat(16), 'each ear on its own half, its pitch at its rail')
  let pans = buffer((t, c) => t < 1 ? (c ? 0 : 0.5) : t < 2 ? (c ? 0.5 : 0) : 0.5, 3)
  is(draw.pan(pans).map(([x]) => x === 2 ? 'L' : x === 92 ? 'R' : x === 50 ? 'C' : x).join(''), 'L'.repeat(5) + 'R'.repeat(5) + 'C'.repeat(5), 'left, right, centre, one dash per row, time running down')
  let clicks = buffer(t => Number.isInteger(t * 4) ? 0.5 : 0, 3)
  is(draw.raster(clicks).map(([x, y]) => `${x},${y}`).join(' '), Array.from({ length: 12 }, (_, n) => `${3 + (n * 20 % 16) * 6},${6 + Math.floor(n * 20 / 16) * 6}`).join(' '), 'a click every quarter second is a dot every twenty cells, scanning row by row')
  let thumbs = [...documentOf('examples/index.html').querySelectorAll('.example-thumb')]
  is(thumbs.length, examples.length, 'every example has a thumbnail on the page')
  ok(thumbs.every(thumb => thumb.getAttribute('viewBox') === '0 0 96 96'), 'all square')
  ok(thumbs.every(thumb => [...thumb.querySelectorAll('path')].every(path => /^[MLh\d.\s-]+$/.test(path.getAttribute('d')))), 'straight strokes and dots only, no curves')
})

test('all local HTML, CSS, JS, and navigation targets resolve', () => {
  let missing = []
  for (let path of htmlFiles) {
    let document = documentOf(path)
    for (let element of document.querySelectorAll('[href], [src], [data-run]')) {
      let value = element.getAttribute('href') || element.getAttribute('src') || element.getAttribute('data-run')
      if (value == null) continue
      let target = localTarget(path, value)
      if (target && !existsSync(target)) missing.push(`${path}: ${value}`)
    }
  }
  is(missing.join('\n'), '')
})

test('every CLI is a thin adapter over its browser-safe graph module', () => {
  for (let example of examples) {
    ok(read(`examples/${example.id}.js`).includes(`from './graphs/${example.id}.js'`), `${example.id} shared graph`)
    let graph = read(`examples/graphs/${example.id}.js`)
    ok(graph.startsWith(`// ${example.title}:`), `${example.id} source is self-descriptive`)
    ok(graph.includes(`// CLI: ${example.command}`), `${example.id} source carries its CLI invocation`)
    ok(!/^import\s/m.test(graph), `${example.id} source is atomic`)
    ok(!/function result\b|return result\(/.test(graph), `${example.id} returns its graph object directly`)
    ok(!/from ['"](?:web-audio-api|node:)/.test(graph), `${example.id} has no runtime import`)
    ok(!/\bprocess\.(?:argv|stdin|stdout|exit)\b|\bdocument\./.test(graph), `${example.id} has no CLI or DOM boundary`)
  }
  is(readdirSync(join(root, 'examples')).filter(name => /^_.*\.js$/.test(name)).length, 0, 'no underscore example architecture')
})

test('every realtime or offline graph core renders finite audible samples', async () => {
  let sampleRate = 44100
  let length = Math.ceil(sampleRate * 0.12)
  let options = {
    impulse: { count: 1 },
    dtmf: { digits: '5', speed: 0.06 },
    'stereo-test': { durationPerChannel: 0.06, gap: 0.01 },
    metronome: { pattern: 'X', bpm: 600 },
    'risset-rhythm': { bpm: 600 },
    sequencer: { bpm: 600 },
  }
  for (let id of Object.keys(graphBuilders)) {
    let ctx = new OfflineAudioContext(2, length, sampleRate)
    let graph = await buildGraph(id, ctx, { duration: 0.1, when: 0, AudioWorkletNodeClass: AudioWorkletNode, ...options[id] })
    let audio = await ctx.startRendering()
    let peak = 0, energy = 0, finite = true
    for (let channel = 0; channel < audio.numberOfChannels; channel++) for (let sample of audio.getChannelData(channel)) {
      finite &&= Number.isFinite(sample)
      peak = Math.max(peak, Math.abs(sample))
      energy += sample * sample
    }
    ok(graph.sources.length > 0, `${id}: source`)
    is(audio.length, length, `${id}: frame count`)
    ok(finite, `${id}: finite`)
    ok(peak > 1e-7, `${id}: audible`)
    ok(peak <= 1, `${id}: safety ceiling`)
    ok(energy > 1e-10, `${id}: energy`)
  }
})

test('metronome takes its ramp as bpm=start..end or as a separate to', async () => {
  let { init } = await import('../examples/graphs/metronome.js')
  let render = async options => {
    let ctx = new OfflineAudioContext(1, 44100 * 2, 44100)
    init(ctx, { sound: 'beep', duration: 2, ...options })
    return (await ctx.startRendering()).getChannelData(0)
  }
  let same = (a, b) => a.length === b.length && a.every((value, index) => value === b[index])
  let ramp = await render({ bpm: '80..160' }), held = await render({ bpm: '80' })
  ok(same(ramp, await render({ bpm: '80', to: '160' })), 'the two fields make the same ramp as start..end')
  ok(same(held, await render({ bpm: '80', to: '' })), 'a blank to holds the tempo')
  ok(same(held, await render({ bpm: '80', to: 'soon' })), 'a to that is not a number holds the tempo')
  ok(!same(ramp, held), 'the ramp is audible')
})

test('metronome presets share deterministic, distinct instrument models', async () => {
  let render = async sound => {
    let ctx = new OfflineAudioContext(1, 6615, 44100)
    await buildGraph('metronome', ctx, { bpm: 600, pattern: 'X', duration: 0.12, sound, seed: 17, when: 0 })
    return Array.from((await ctx.startRendering()).getChannelData(0))
  }
  let expectedVoices = { classic: 5, wood: 5, bell: 7, beep: 2, signal: 1, karatala: 9 }
  for (let [sound, voices] of Object.entries(expectedVoices)) {
    let ctx = new OfflineAudioContext(1, 512, 44100)
    let graph = await buildGraph('metronome', ctx, { bpm: 600, pattern: 'X', duration: 0.01, sound, seed: 17, when: 0 })
    is(graph.sources.length, voices, `${sound}: layered source count`)
    await ctx.startRendering()
  }
  let rendered = new Map()
  for (let sound of Object.keys(expectedVoices)) {
    let samples = await render(sound)
    ok(samples.some(Boolean), `${sound}: audible`)
    ok(samples.every(Number.isFinite), `${sound}: finite`)
    rendered.set(sound, samples)
  }
  is(rendered.get('classic').join(','), (await render('classic')).join(','), 'seeded classic is repeatable')
  for (let sound of ['wood', 'bell', 'beep', 'signal', 'karatala']) ok(rendered.get(sound).some((sample, index) => sample !== rendered.get('classic')[index]), `${sound}: distinct from classic`)
})

test('metronome schedules upfront offline but in a bounded window on live contexts', async () => {
  let offline = new OfflineAudioContext(1, 128, 44100)
  let offlineGraph = await buildGraph('metronome', offline, { duration: 600, bpm: '80..240', when: 0 })
  ok(offlineGraph.sources.length > 1000, `offline schedules everything upfront (${offlineGraph.sources.length} sources)`)

  // A live context is anything without startRendering; delegate node creation to
  // a real context so the instrument builds actual nodes
  let backing = new OfflineAudioContext(1, 128, 44100)
  let state = 'running'
  let live = {
    get currentTime() { return backing.currentTime },
    get state() { return state },
    get sampleRate() { return backing.sampleRate },
    get destination() { return backing.destination },
    createGain: () => backing.createGain(),
    createOscillator: () => backing.createOscillator(),
    createBufferSource: () => backing.createBufferSource(),
    createBiquadFilter: () => backing.createBiquadFilter(),
    createBuffer: (...args) => backing.createBuffer(...args),
  }
  let liveGraph = await buildGraph('metronome', live, { duration: 600, bpm: '80..240', when: 0 })
  ok(liveGraph.sources.length < 200, `live scheduling stays inside the lookahead window (${liveGraph.sources.length} sources)`)
  state = 'closed'
  await new Promise(resolve => setTimeout(resolve, 1100)) // scheduler timer sees the closed state and clears itself
})

test('risset layers sit an octave apart and nest their beats', async () => {
  for (let direction of ['up', 'down']) {
    let ctx = new OfflineAudioContext(1, 128, 44100)
    let hits = []
    let graph = await buildGraph('risset-rhythm', ctx, { direction, bpm: 120, duration: 40, when: 0, hit: (time, mark, level) => hits.push({ time, mark, level }) })
    let beats = graph.data.beats
    ok(beats.length > 200 && hits.length === beats.length, `${direction}: beats reach the instrument (${beats.length})`)
    let byLayer = [0, 1, 2].map(layer => beats.filter(beat => beat.layer === layer).map(beat => beat.time))
    let tempoAt = (times, at) => { let i = times.findIndex(time => time > at); return 60 / (times[i] - times[i - 1]) }
    for (let at of [9, 15, 21, 27]) {
      let tempos = byLayer.map(times => tempoAt(times, at)).sort((a, b) => a - b)
      ok(Math.abs(tempos[1] / tempos[0] - 2) < 0.08 && Math.abs(tempos[2] / tempos[1] - 2) < 0.08, `${direction} at ${at}s: octave-spaced tempos (${tempos.map(t => t.toFixed(1)).join(', ')})`)
    }
    // every beat of a slower layer falls on a beat of each faster layer active at that moment
    let nested = 0, checked = 0
    let settled = time => time % 6 > 1.5 && time % 6 < 4.5 // away from a layer's entry or exit ramp, where inaudible beats are skipped
    for (let beat of beats) for (let other of byLayer) {
      if (!settled(beat.time)) continue
      let i = other.findIndex(time => time >= beat.time - 1e-6)
      if (i < 1 || i >= other.length - 1 || other === byLayer[beat.layer]) continue
      let ownTimes = byLayer[beat.layer], j = ownTimes.indexOf(beat.time)
      if (j < 1 || j >= ownTimes.length - 1) continue
      if (other[i + 1] - other[i - 1] >= (ownTimes[j + 1] - ownTimes[j - 1]) * 0.9) continue
      checked++
      if (Math.abs(other[i] - beat.time) < 1e-6) nested++
    }
    ok(checked > 50 && nested === checked, `${direction}: slower beats nest in faster layers (${nested}/${checked})`)
    let seconds = Array.from({ length: 36 }, (_, s) => beats.filter(beat => beat.time >= s + 2 && beat.time < s + 3).reduce((sum, beat) => sum + beat.level, 0))
    ok(Math.max(...seconds) < Math.min(...seconds) * 2, `${direction}: windowed loudness stays level`)
  }
})

test('jazz styles and leads render distinct finite performances that repeat by seed', async () => {
  let render = async options => {
    let ctx = new OfflineAudioContext(2, 44100 * 2, 44100)
    let graph = await buildGraph('jazz', ctx, { duration: 8, bpm: 120, when: 0, seed: 11, AudioWorkletNodeClass: AudioWorkletNode, ...options })
    let data = (await ctx.startRendering()).getChannelData(0)
    ok(data.every(Number.isFinite) && data.some(Boolean), `${JSON.stringify(options)}: finite, audible`)
    ok(data.reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0) <= 1, `${JSON.stringify(options)}: safety ceiling`)
    return { graph, data }
  }
  let styles = ['modal', 'ambient', 'nordic', 'ballad', 'bossa', 'swing', 'blues'], rendered = new Map()
  for (let style of styles) rendered.set(style, await render({ style }))
  for (let style of styles) {
    let { graph } = rendered.get(style)
    is(graph.data.style, style)
    ok(graph.data.bassNotes.length > 0 && graph.data.leadNotes.length > 0, `${style}: bass and lead were written`)
    ok(graph.data.leadNotes.every(note => note.position >= 0 && note.beats > 0), `${style}: lead notes are placed`)
    for (let other of styles) if (other !== style) ok(rendered.get(style).data.some((sample, index) => sample !== rendered.get(other).data[index]), `${style} differs from ${other}`)
  }
  let repeat = await render({ style: 'swing' })
  let composition = graph => JSON.stringify([graph.data.bpm, graph.data.key, graph.data.chordLog, graph.data.bassNotes, graph.data.leadNotes])
  is(composition(repeat.graph), composition(rendered.get('swing').graph), 'the same seed repeats the composition; only the drum noise worklet is live')
  for (let lead of ['flute', 'harp', 'piano']) {
    let other = await render({ style: 'swing', lead })
    is(other.graph.data.lead, lead)
    ok(other.data.some((sample, index) => sample !== rendered.get('swing').data[index]), `the ${lead} lead sounds different`)
  }
  let walking = rendered.get('swing').graph.data.bassNotes
  ok(walking.every(note => note.beats === 1), 'swing walks in quarter notes')
  let ballad = rendered.get('ballad').graph.data.bassNotes
  ok(ballad.some(note => note.beats === 2), 'the ballad bass plays in two')
  let modal = rendered.get('modal').graph.data
  let modalBass = modal.bassNotes.map(note => note.note)
  ok(modalBass.every((note, i) => i === 0 || note !== modalBass[i - 1]), 'the modal bass never strikes the same note twice in a row')
  ok(modal.bassNotes.filter(note => note.beats >= 2).length > modal.bassNotes.length / 2, 'and mostly holds')
  ok(modal.bassNotes.every(note => note.note <= 40), 'the bass stays in its low octave')
  ok(modal.chords.every(c => ['m11', 'm7', 'sus', 'maj7#11'].includes(c.quality)), 'modal harmony is extended')
  ok(modal.chords.slice(1).every((c, i) => { let move = Math.abs(c.root - modal.chords[i].root) % 12; return move !== 1 && move !== 11 }), 'modal roots never move by a bare half step')
})

test('shepard bank sweeps beyond 12 kHz', async () => {
  let sampleRate = 44100, seconds = 2.5
  let ctx = new OfflineAudioContext(1, sampleRate * seconds, sampleRate)
  await buildGraph('shepard', ctx, { direction: 'up', rate: 0.5, duration: seconds, when: 0, AudioWorkletNodeClass: AudioWorkletNode })
  let data = (await ctx.startRendering()).getChannelData(0)
  let magnitudeAt = (start, frequency) => {
    let n = 4096, coefficient = 2 * Math.cos(2 * Math.PI * frequency / sampleRate)
    let s1 = 0, s2 = 0
    for (let i = 0; i < n; i++) { let s0 = data[start + i] + coefficient * s1 - s2; s2 = s1; s1 = s0 }
    return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - coefficient * s1 * s2)) / n
  }
  let peak = 0
  for (let t = 0; t < seconds - 0.2; t += 0.25) peak = Math.max(peak, magnitudeAt(Math.floor(t * sampleRate), 12000))
  ok(peak > 1e-4, `12 kHz content present as the top voices climb (peak ${peak.toExponential(2)})`)
})

test('shepard waveforms render distinct finite audio', async () => {
  let render = async wave => {
    let ctx = new OfflineAudioContext(1, 8192, 44100)
    await buildGraph('shepard', ctx, { direction: 'up', rate: 0.5, wave, duration: 1, when: 0, AudioWorkletNodeClass: AudioWorkletNode })
    return (await ctx.startRendering()).getChannelData(0)
  }
  let sine = await render('sine')
  for (let wave of ['triangle', 'square', 'sawtooth']) {
    let data = await render(wave)
    ok(data.every(Number.isFinite), `${wave}: finite`)
    ok(data.some(sample => Math.abs(sample) > 1e-4), `${wave}: audible`)
    ok(data.some((sample, index) => sample !== sine[index]), `${wave}: distinct from sine`)
  }
})

test('seeded graphs repeat and cleanup leaves only the replacement', async () => {
  let renderNoise = async seed => {
    let ctx = new OfflineAudioContext(1, 256, 44100)
    await buildGraph('noise', ctx, { color: 'white', duration: 256 / 44100, seed, when: 0 })
    return Array.from((await ctx.startRendering()).getChannelData(0))
  }
  let a1 = await renderNoise(17), a2 = await renderNoise(17), b = await renderNoise(18)
  is(a1.join(','), a2.join(','), 'same seed')
  ok(a1.some((sample, index) => sample !== b[index]), 'different seed')

  let render = async withCleanup => {
    let ctx = new OfflineAudioContext(1, 1024, 44100)
    if (withCleanup) {
      stopGraph(null)
      let first = await buildGraph('tone', ctx, { duration: 0.01, when: 0 })
      stopGraph(first); stopGraph(first)
      let repeated = await buildGraph('tone', ctx, { frequency: 220, duration: 0.01, when: 0 })
      stopGraph(repeated)
    }
    await buildGraph('sweep', ctx, { from: 100, to: 500, mode: 'linear', duration: 1024 / 44100, gain: 0.2, when: 0 })
    return Array.from((await ctx.startRendering()).getChannelData(0))
  }
  is((await render(true)).join(','), (await render(false)).join(','), 'cleanup sequence')
  let ctx = new OfflineAudioContext(1, 128, 44100)
  throws(() => buildGraph('missing', ctx), /No browser-safe graph is registered/)
})

test('processed-buffer core renders the smallest valid input', async () => {
  let ctx = new OfflineAudioContext(1, 128, 44100)
  let input = ctx.createBuffer(1, 1, 44100)
  input.getChannelData(0)[0] = 0.5
  let graph = buildProcessedBuffer(ctx, input, { when: 0 })
  let samples = (await ctx.startRendering()).getChannelData(0)
  is(graph.duration, 1 / 44100)
  ok(samples.every(Number.isFinite))
  ok(samples.some(sample => sample !== 0))
})

test('unsafe listening examples retain explicit safety language', () => {
  for (let id of ['binaural-beats', 'mic', 'recorder', 'octave-illusion', 'scale-illusion', 'huggins-pitch', 'latency-tester', 'tuner', 'level-meter']) {
    let example = examples.find(item => item.id === id)
    ok(example.warning?.length > 30, `${id} warning`)
  }
})

test('code uses MicroLighter with plain-code fallback', () => {
  ok(read('syntax.js').includes('microlighter@2.1.0/dist/index.js'))
  for (let path of ['index.html']) {
    for (let code of documentOf(path).querySelectorAll('pre > code')) ok([...code.classList].some(name => name.startsWith('language-')), `${path}: language class`)
  }
})

// A rule nothing can match is dead weight: every selector must find its skeleton on a page that loads the
// sheet, once classes the scripts add and children they build are counted as present.
function deadRules(sheet, pages, scripts) {
  let css = read(sheet), js = scripts.map(read).join('\n'), docs = pages.map(documentOf)
  let rules = [], stack = [], segment = 0
  for (let i = 0; i < css.length; i++) {
    let c = css[i]
    if (c === '/' && css[i + 1] === '*') { i = css.indexOf('*/', i + 2) + 1; continue }
    if (c === '"' || c === "'") { let q = c; for (i++; i < css.length && css[i] !== q; i++) if (css[i] === '\\') i++; continue }
    if (c === '{') { stack.push(css.slice(segment, i).replace(/\/\*[\s\S]*?\*\//g, '').trim()); segment = i + 1 }
    else if (c === '}') { let head = stack.pop(); if (!head.startsWith('@') && !stack.some(at => /^@(keyframes|font-face|property)/.test(at))) rules.push(head); segment = i + 1 }
    else if (c === ';') segment = i + 1
  }
  let skeleton = selector => selector
    .replace(/::?[a-z-]+\([^)]*\)/gi, m => /^:(not|is|where|nth-child|nth-of-type|nth-last-child|has)\(/i.test(m) ? m : '')
    .replace(/::[a-z-]+/gi, '')
    .replace(/:(hover|focus|focus-visible|focus-within|active|disabled|checked|open|target|visited|empty|placeholder-shown|invalid|valid|required|enabled|link|any-link|popover-open|modal|defined)\b/gi, '')
    .replace(/\[[^\]]*\]/g, '').trim()
  let onPage = selector => docs.some(doc => { try { return !!doc.querySelector(selector) } catch { return true } })
  let live = selector => {
    let bones = skeleton(selector)
    if (!bones || /^(:root|html|body|\*)$/.test(bones) || onPage(bones)) return true
    let compounds = bones.split(/\s*[>+~]\s*|\s+(?![^(]*\))/).filter(Boolean).map(compound => {
      let rest = compound.replace(/[.#]([A-Za-z_][\w-]*)/g, (m, id) => js.includes(id) ? '' : m).trim()
      return rest.replace(/^[a-z][\w-]*$/i, '*') || '*'
    })
    while (compounds.length && compounds.at(-1) === '*') compounds.pop()
    return !compounds.length || onPage(compounds.join(' '))
  }
  return rules.filter(head => !head.split(/,(?![^(]*\))/).some(selector => live(selector.trim())))
}

test('every stylesheet rule can match a page that loads it', () => {
  let scripts = ['examples/browser.js', 'syntax.js', 'site.js', 'graph.js', 'scripts/render.mjs', 'scripts/build-site.mjs']
  is(deadRules('assets/site.css', ['index.html', '404.html', ...examplePages], scripts).join(' | '), '', 'the sheet carries no rule its pages cannot use')
})

test('site CSS keeps the token system and Catalogue constraints', () => {
  let css = read('assets/site.css')
  let rules = css.replace(/\/\*[\s\S]*?\*\//g, '')
  ok(css.startsWith('/* web-audio-api'))
  ok(rules.includes('prefers-reduced-motion'))
  ok(rules.includes(':focus-visible'))
  ok(rules.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'), 'two-column example catalogue')
  ok(!/transition\s*:\s*all\b/.test(rules))
  ok(!/\b100vw\b/.test(rules))
  ok(!/overflow-x\s*:\s*hidden/.test(rules))
  ok(!/#[0-9a-f]{3,8}\b/i.test(rules.replace(/url\(#[\w-]+\)/g, '')))
  ok(!/\b(?:rgb|hsl|oklch)\(/i.test(rules), 'raw colors stay in tokens')
  ok(!/font-family\s*:(?!\s*var\()/i.test(rules))
  ok(read('assets/tokens.css').includes('--font-display: "Inter"'))
  ok(rules.includes('overflow-x: clip'))
  ok(rules.includes('scrollbar-gutter: stable'))
  ok(!/(?:^|\n)\*\s*\{[^}]*scrollbar/.test(rules) && !/html\s*\{[^}]*scrollbar-gutter/.test(rules), 'the page keeps the browser\'s own scrollbar; only panes and the modal style theirs')
  ok(rules.includes('scrollbar-color: color-mix(in oklab, var(--color-paper) 35%, transparent) transparent'), 'scrolling panes keep a visible thumb on a transparent track')
  ok(rules.includes('html.modal-open { overflow: hidden; }'))
  ok(!/\.hero\s*\{[^}]*border-block-end/s.test(rules), 'no divider before Examples')
  ok(!/\.faq\s*\{[^}]*border-block-start/s.test(rules), 'no divider before Questions')
  ok(/\.example-group h3\s*\{[^}]*position:\s*sticky/s.test(rules), 'category headers stick while their group scrolls')
  ok(/\.demo-panel\s*\{[^}]*position:\s*sticky/s.test(rules), 'the demo panel pins beside its scrolling source column')
})

test('research and product decisions are documented', () => {
  ok(existsSync(join(root, 'website.md')))
  let research = read('website.md')
  for (let heading of ['## Users', '## Jobs and trigger moments', '## Positioning', '## Evidence', '## Alternatives', '## Open questions', '## Sources']) ok(research.includes(heading), heading)
})

test('FAQ uses scoped adapter links, practical code, and broader decoder context', () => {
  let document = documentOf('index.html')
  ok(document.querySelector('a[href="https://github.com/audiojs/speaker"] code').textContent.includes('@audio/speaker'))
  ok(document.querySelector('a[href="https://github.com/audiojs/mic"] code').textContent.includes('@audio/mic'))
  ok(document.body.textContent.includes('does not vary by browser or operating system'))
  for (let question of ['Do Tone.js and other libraries work?', 'How do I test audio in CI?', 'Can it run without speakers?', 'Does it support AudioWorklets?']) {
    let details = [...document.querySelectorAll('.faq details')].find(item => item.querySelector('summary').textContent === question)
    ok(details.querySelector('pre > code.language-javascript'), `${question} code`)
  }
})

test('site avoids autoplay, fabricated proof, generic interaction copy, and middle-dot separators', () => {
  let html = htmlFiles.map(read).join('\n')
  ok(!html.includes('·'))
  ok(![read('examples/browser.js'), read('examples/catalog.js'), read('site.js')].join('\n').includes('·'))
  ok(!/\bautoplay\b/i.test(html))
  ok(!/>\s*Click here\s*</i.test(html))
  ok(!/trusted by|10× faster|99\.9% uptime/i.test(html))
  ok(!/Jane Doe|John Smith|Lorem Ipsum/i.test(html))
})
