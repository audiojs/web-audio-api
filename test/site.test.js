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
const guidePages = [
  'guides/browser-to-node/index.html',
  'guides/test-audio-in-ci/index.html',
  'guides/tonejs-node/index.html',
]
const examplePages = ['examples/index.html', ...examples.map(example => `examples/${example.id}/index.html`)]
const htmlFiles = ['index.html', ...guidePages, ...examplePages]

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
    ok(example.command.startsWith('node examples/'), `${example.id} command`)
  }
})

test('homepage is only the hero, example catalogue, compact FAQ, and footer', () => {
  let document = documentOf('index.html')
  is(document.querySelector('#hero-title strong').textContent, 'Web Audio API')
  is(document.querySelector('#hero-title span').textContent, 'without browser')
  is(document.querySelector('.hero-lede').textContent.trim(), 'Your web-audio code, cross-platform. No native bindings, no compilation. Process audio in batch, unit-test it in CI, stream from servers, render at the edge, script it in CLI.')
  is([...document.querySelectorAll('.hero-lede strong')].map(node => node.textContent).join('|'), 'No native bindings|no compilation', 'key claims stand out of the gray lede')
  is([...document.querySelectorAll('.hero-lede .hero-stack button')].map(node => node.getAttribute('aria-label')).join('|'), 'Node|Deno|Bun|Porffor', 'engine icons ride inline with the lede')
  is([...document.querySelectorAll('.hero-stack button[data-engine]')].map(node => node.dataset.engine).join('|'), 'node|deno|bun|porffor', 'every engine is a selectable pill')
  is(document.querySelectorAll('.hero-stack button[aria-pressed="true"]').length, 1, 'one engine selected by default')
  ok(read('site.js').includes("'npm:web-audio-api'"), 'selecting Deno rewrites the import specifier')
  ok(!document.querySelector('.site-footer .wpt-badge'), 'no badge in the footer')
  ok(read('.github/workflows/wpt.yml').includes('name: W3C WPT'), 'the dedicated WPT workflow names the badge')
  ok(!document.querySelector('.hero-spec img'), 'spec plate carries no badge image')
  is(document.querySelectorAll('header a').length, 5, 'brand, section nav, version, and GitHub')
  is([...document.querySelectorAll('header nav a')].map(node => `${node.textContent}=${node.getAttribute('href')}`).join('|'), 'Examples=#examples|Questions=#faq', 'sections ride the navigation')
  ok(document.querySelector('header a.brand[href="./"] svg path[d^="M3.72998"]'), 'the site seal leads home')
  ok(document.querySelector('header a.version-link[href="https://www.npmjs.com/package/web-audio-api"] [data-version]'), 'the version links to npm')
  ok(document.querySelector('header a[href="https://github.com/audiojs/web-audio-api"]'))
  is(document.querySelectorAll('header nav').length, 1, 'one primary navigation')
  is(document.querySelector('.install-command').textContent.trim(), 'npm install web-audio-api')
  is(document.querySelectorAll('.install-command button').length, 0, 'install command has no copy button')
  ok(!document.body.textContent.includes('Basic usage'))
  is(document.querySelector('.hero-spec a[href="https://packagephobia.com/result?p=web-audio-api"]').textContent, '54 KB gzipped', 'size leads to packagephobia')
  is(document.querySelector('.site-footer a[href="https://github.com/audiojs/web-audio-api/blob/master/LICENSE"]').textContent, 'MIT', 'MIT leads to the license')
  ok(document.querySelector('.site-footer a[href="https://github.com/krishnized/license"]'), 'krishnized dedication rides the footer')
  ok(document.querySelector('.site-footer').textContent.includes('2013'), 'footer carries since 2013')
  ok(document.querySelector('.site-footer .footer-brand[href="https://audiojs.dev/"] svg path[d^="M28.6572"]'), 'footer carries the audiojs org mark')
  is(document.querySelector('.hero-spec a[href="https://github.com/audiojs/web-audio-api/actions/workflows/wpt.yml"]').textContent, 'W3C WPT 100%', 'the WPT claim rides the spec plate as plain text')
  ok(document.querySelector('.site-footer a[href="https://github.com/sponsors/audiojs"]'), 'footer invites support')
  ok(document.querySelector('.site-footer a[href="https://github.com/sebpiq"]') && document.querySelector('.site-footer a[href="https://github.com/dy"]'), 'authors are credited with links')
  is(document.querySelector('.hero-code [data-copy]').textContent.trim(), '', 'code copy is icon-only')
  is([...document.querySelectorAll('main > section > .section-heading h2')].map(node => node.textContent).join('|'), 'Examples|Questions')
  ok(document.querySelector('.section-heading #example-filters[role="group"]'), 'examples are filterable by tag')
  ok(read('site.js').includes("querySelector('.example-tag')"), 'the filter reads the tag element the entries actually render')
  ok(!document.querySelector('[data-example-count]'), 'no static graph count')
  ok(document.querySelector('.faq table.bench'), 'realtime answer carries measured numbers')
  is(document.querySelector('.comparison tbody tr th').textContent, 'Engine', 'alternatives table lists aspects as rows, packages as columns')
  ok(document.querySelector('.install-row .hero-spec'), 'the install command carries its spec plate')
  let links = [...document.querySelectorAll('[data-open-example]')]
  is(links.length, examples.length)
  is([...document.querySelectorAll('.example-group h3')].map(node => node.textContent).join('|'), 'Utilities|Test signals|Illusions|Synthesis|Generative|API', 'groups run by search demand')
  is(document.querySelector('.examples .section-heading p').textContent, 'Every example is one runnable file: play it here, run it in Node, drop it into CI.', 'the examples heading states the value')
  for (let [index, example] of examples.entries()) {
    let link = links[index]
    is(link.dataset.openExample, example.id, `${example.id}: catalogue order`)
    is(link.querySelector('.example-number').textContent, String(index + 1).padStart(2, '0'), `${example.id}: catalogue number`)
    is(link.querySelector('.example-heading strong').textContent, example.title, `${example.id}: title`)
    is(link.querySelector('.example-description + .example-tag').textContent, example.job, `${example.id}: job tag closes the entry`)
    is(link.querySelector('.example-description').textContent, example.description, `${example.id}: description`)
    is(link.getAttribute('href'), `./examples/${example.id}/`, `${example.id}: crawlable route`)
    ok(link.querySelector('.example-arrow'), `${example.id}: open arrow`)
  }
  let dialog = document.querySelector('dialog#example-dialog')
  ok(dialog)
  ok(dialog.querySelector('.dialog-body > :first-child').classList.contains('demo-panel'), 'demo precedes source')
  is(dialog.querySelectorAll('.dialog-code-head, .dialog-links, .code-output [data-copy]').length, 0, 'code view has no redundant chrome')
  is([...dialog.querySelectorAll('.code-tab')].map(tab => tab.dataset.pane).join('|'), 'cli|code', 'source panel offers CLI and code views')
  ok(dialog.querySelector('.code-tab[data-pane="cli"][aria-pressed="true"]'), 'CLI view is the default')
  ok(dialog.querySelector('.cli-command [data-copy="#cli-command"]'), 'CLI command is copyable')
  ok(dialog.querySelector('.code-output[hidden]'), 'code stays hidden until requested')
  ok(dialog.querySelector('#demo-spectrogram'), 'demo includes a spectrogram')
  ok(dialog.querySelector('.demo-spectrogram-wrap #demo-frequency-scale'), 'scale selector overlays the spectrogram')
  is(dialog.querySelectorAll('#demo-frequency-scale option').length, 3, 'linear, mel, and log scales are available')
  ok(dialog.querySelector('.demo-runbar #demo-run .play-glyph'), 'run action is a play control in its own footer')
  ok(dialog.querySelector('.demo-runbar #demo-volume'), 'output volume rides the runbar')
  ok(!dialog.querySelector('.detail-seo'), 'SEO text never rides the modal')
  is(document.querySelectorAll('[role="tab"]').length, 0)
  let questions = [...document.querySelectorAll('.faq summary')].map(node => node.textContent.trim())
  for (let expected of ['Is it fast enough for realtime?', 'How does audio I/O work?', 'Which formats can it decode?', 'How big is the install?', 'Does Tone.js work?', 'Can I test audio in CI?', 'Can it run without speakers?', 'Does it support AudioWorklets?', 'What differs from a browser?', 'How does it compare to alternatives?']) ok(questions.includes(expected), expected)
})

test('every CLI option schema matches its source and --help output', () => {
  is(Object.keys(exampleOptions).sort().join(','), examples.map(example => example.id).sort().join(','))
  for (let example of examples) {
    let source = read(`examples/${example.id}.js`)
    let block = source.match(/\n\s*options:\s*(\[[\s\S]*?\]),\n\s*(?:controls:|notes:|\}\))/)?.[1]
    let documented = block ? [...block.matchAll(/\[\s*(['"`])(.+?)\1\s*,/g)].map(match => match[2]) : []
    let schema = optionsFor(example.id).map(option => option.syntax)
    is(schema.join('|'), documented.join('|'), `${example.id}: schema and CLI source`)
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
  is(documentOf('index.html').querySelector('link[rel="canonical"]').href, pkg.homepage)
  let sitemap = read('sitemap.xml')
  is((sitemap.match(/<url>/g) || []).length, examples.length + 1, 'homepage and every example are indexed')
  for (let example of examples) ok(sitemap.includes(`${pkg.homepage}examples/${example.id}/`), `${example.id} sitemap URL`)
})

test('homepage, guides, and example pages share the AudioJS favicon', () => {
  let homeIcons = documentOf('index.html').querySelectorAll('link[rel="icon"]')
  is(homeIcons.length, 1, 'homepage: one favicon')
  let homeIcon = homeIcons[0]
  is(homeIcon.type, 'image/svg+xml')
  ok(homeIcon.getAttribute('href').startsWith('data:image/svg+xml,'))
  for (let path of [...guidePages, ...examplePages.slice(1)]) {
    let icons = documentOf(path).querySelectorAll('link[rel="icon"]')
    is(icons.length, 1, `${path}: one favicon`)
    is(icons[0].type, homeIcon.type, `${path}: favicon type`)
    is(icons[0].getAttribute('href'), homeIcon.getAttribute('href'), `${path}: favicon source`)
  }
})

test('every example has a crawlable canonical detail page', () => {
  is(documentOf('examples/index.html').querySelector('meta[http-equiv="refresh"]').content, '0; url=../#examples')
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
    is(document.querySelectorAll('.detail-tags span').length, 2, `${example.id} category and job tags`)
    is(document.querySelectorAll('.dialog-code-head, .dialog-links, .code-output [data-copy]').length, 0, `${example.id} code chrome removed`)
    is(document.querySelector('#cli-command').textContent, example.command, `${example.id} CLI command`)
    is(document.querySelectorAll('.cli-options dt').length, optionsFor(example.id).length, `${example.id} CLI options documented`)
    ok(document.querySelector('.code-tab[data-pane="cli"][aria-pressed="true"]'), `${example.id} CLI view default`)
    ok(document.querySelector('#demo-spectrogram'), `${example.id} spectrogram`)
    ok(document.querySelector('.demo-runbar #demo-run .play-glyph'), `${example.id} separate run footer`)
    ok(document.querySelector('script[type="application/ld+json"]'), `${example.id} structured data`)
    ok(document.querySelector('.detail-actions .brand[href="../../"]'), `${example.id} logo leads home`)
    is(!!document.querySelector('.detail-seo'), !!example.seo, `${example.id} SEO text on its own page`)
  }
})

test('all local HTML, CSS, JS, and navigation targets resolve', () => {
  let missing = []
  for (let path of htmlFiles) {
    let document = documentOf(path)
    for (let element of document.querySelectorAll('[href], [src]')) {
      let value = element.getAttribute('href') || element.getAttribute('src')
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

test('metronome presets share deterministic, distinct instrument models', async () => {
  let render = async sound => {
    let ctx = new OfflineAudioContext(1, 6615, 44100)
    await buildGraph('metronome', ctx, { bpm: 600, pattern: 'X', duration: 0.12, sound, seed: 17, when: 0 })
    return Array.from((await ctx.startRendering()).getChannelData(0))
  }
  let expectedVoices = { classic: 3, wood: 4, bell: 4, beep: 2, signal: 1, karatala: 5 }
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
  for (let id of ['sweep', 'impulse', 'stereo-test', 'binaural-beats', 'mic', 'recorder', 'octave-illusion', 'scale-illusion', 'huggins-pitch', 'latency-tester']) {
    let example = examples.find(item => item.id === id)
    ok(example.warning?.length > 30, `${id} warning`)
  }
})

test('code uses MicroLighter with plain-code fallback', () => {
  ok(read('syntax.js').includes('microlighter@2.1.0/dist/index.js'))
  for (let path of ['index.html', ...guidePages]) {
    for (let code of documentOf(path).querySelectorAll('pre > code')) ok([...code.classList].some(name => name.startsWith('language-')), `${path}: language class`)
  }
})

test('site CSS keeps the token system and Catalogue constraints', () => {
  let css = read('site.css')
  let rules = css.replace(/\/\*[\s\S]*?\*\//g, '')
  ok(css.startsWith('/* Hallmark ·'))
  ok(css.includes('macrostructure: Catalogue'))
  ok(!/transition\s*:\s*all\b/.test(rules))
  ok(!/\b100vw\b/.test(rules))
  ok(!/overflow-x\s*:\s*hidden/.test(rules))
  ok(!/#[0-9a-f]{3,8}\b/i.test(rules))
  ok(!/\b(?:rgb|hsl|oklch)\(/i.test(rules), 'raw colors stay in tokens')
  ok(!/font-family\s*:(?!\s*var\()/i.test(rules))
  ok(read('tokens.css').includes('--font-display: "Geist"'))
  ok(!read('tokens.css').includes('Orbitron'))
  ok(rules.includes('overflow-x: clip'))
  ok(rules.includes('scrollbar-gutter: stable'))
  ok(rules.includes('scrollbar-color: transparent transparent'))
  ok(rules.includes('scrollbar-color: var(--color-muted) transparent'), 'modal scrollbar remains visible')
  ok(rules.includes('html.modal-open { overflow: hidden; }'))
  ok(!/\.hero\s*\{[^}]*border-block-end/s.test(rules), 'no divider before Examples')
  ok(!/\.faq\s*\{[^}]*border-block-start/s.test(rules), 'no divider before Questions')
  ok(/\.example-group h3\s*\{[^}]*position:\s*sticky/s.test(rules), 'category headers stick while their group scrolls')
  ok(/\.demo-panel\s*\{[^}]*position:\s*sticky/s.test(rules), 'demo panel pins beside the scrolling source column')
  ok(!/(?:^|[{}])\s*\.brand\b/m.test(rules), 'home mark styles do not override guide brand links')
  ok(/\.corner-action \.brand\s*\{/.test(rules), 'home mark styles stay scoped to its header')
  ok(/\.demo-stage\s*\{[^}]*position:\s*sticky/s.test(rules), 'visualizations stick to the viewport top')
  ok(/\.demo-runbar\s*\{[^}]*position:\s*sticky/s.test(rules), 'run footer sticks to the viewport bottom')
  ok(rules.includes('prefers-reduced-motion'))
  ok(rules.includes(':focus-visible'))
  ok(rules.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'), 'two-column example catalogue')
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
  ok(document.body.textContent.includes('broader and more predictable'))
  for (let question of ['Does Tone.js work?', 'Can I test audio in CI?', 'Can it run without speakers?', 'Does it support AudioWorklets?']) {
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
