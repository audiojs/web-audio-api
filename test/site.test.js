import test, { is, ok, throws } from 'tst'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseHTML } from 'linkedom'
import { OfflineAudioContext } from '../index.js'
import { examples, categories } from '../examples/_catalog.js'
import { controlsFor, exampleOptions, optionsFor } from '../examples/_options.js'
import { buildPortable, buildProcessedBuffer, portableBuilders, stopPortable } from '../examples/_portable.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = path => readFileSync(join(root, path), 'utf8')
const pkg = JSON.parse(read('package.json'))
const htmlFiles = [
  'index.html',
  'examples/index.html',
  ...examples.map(example => `examples/${example.id}/index.html`),
  'guides/browser-to-node/index.html',
  'guides/test-audio-in-ci/index.html',
  'guides/tonejs-node/index.html',
]

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

test('site catalog covers every runnable repository example exactly once', () => {
  is(examples.length, 33)
  is(new Set(examples.map(example => example.id)).size, examples.length)
  is(categories.length, 5)
  let sourceIds = readdirSync(join(root, 'examples'), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.js') && !entry.name.startsWith('_'))
    .map(entry => entry.name.slice(0, -3))
    .sort()
  is(sourceIds.join(','), examples.map(example => example.id).sort().join(','))
  for (let example of examples) {
    ok(existsSync(join(root, 'examples', `${example.id}.js`)), `${example.id} CLI source`)
    ok(existsSync(join(root, 'examples', example.id, 'index.html')), `${example.id} page`)
    ok(example.command.startsWith('node examples/'), `${example.id} command`)
    ok(example.graph.includes('→'), `${example.id} graph path`)
  }
})

test('every CLI loads and its documented options match its example page', () => {
  is(Object.keys(exampleOptions).sort().join(','), examples.map(example => example.id).sort().join(','))
  for (let example of examples) {
    let output = execFileSync(process.execPath, [`examples/${example.id}.js`, '--help'], { cwd: root, encoding: 'utf8' })
    let section = output.match(/\nOptions:\n([\s\S]*?)(?=\n\n(?:Controls:|Note:| {2}-h, --help))/)?.[1]
    let cli = section ? section.trim().split('\n').map(line => line.trim().split(/\s{2,}/)[0]) : []
    let page = optionsFor(example.id).map(option => option.syntax)
    is(page.join('|'), cli.join('|'), `${example.id}: page and CLI options`)
    is(new Set(controlsFor(example.id).map(control => control.key)).size, controlsFor(example.id).length, `${example.id}: unique browser controls`)
    let document = documentOf(`examples/${example.id}/index.html`)
    let rendered = [...document.querySelectorAll('.cli-options dt code')].map(code => code.textContent)
    is(rendered.join('|'), cli.join('|'), `${example.id}: rendered CLI options`)
    is(Boolean(document.querySelector('.no-options')), cli.length === 0, `${example.id}: explicit no-options state`)
  }
})

test('homepage states the portable value proposition and serious boundaries', () => {
  let html = read('index.html')
  let document = documentOf('index.html')
  let headline = document.querySelector('h1').textContent.replace(/\s+/g, ' ').trim()
  ok(headline.startsWith('Web Audio,') && headline.endsWith('without the browser.'))
  ok(html.includes('Basic usage'))
  is([...document.querySelectorAll('main > section h2')].map(heading => heading.textContent).join('|'), 'Use cases|Testing in CI|Tone.js in Node|Compatibility and limits|FAQ')
  ok(!html.includes('data-hero-demo'), 'no decorative homepage audio demo')
  ok(!html.includes('compact-index'), 'full catalog is not duplicated on the homepage')
  ok(!html.includes('role="tab"'), 'runtime code is one block, not tabs')
  ok(html.includes('JZ/WASM lane in progress'))
  ok(html.includes('experimental, not a latency guarantee'))
  ok(html.includes('AudioWorklet currently runs synchronously'))
  ok(html.includes('Browser demos use the browser’s native engine'))
  ok(html.includes('https://audiojs.dev/'))
  is(document.querySelector('[data-metric="examples"]').textContent.trim(), '33')
  ok(/^\d{1,3},\d{3} \/ \d{1,3},\d{3}$/.test(document.querySelector('[data-metric="wpt"]').textContent.trim()))
})

test('package, README, and page canonicals agree on the site URL', () => {
  is(pkg.homepage, 'https://audiojs.dev/web-audio-api/')
  ok(read('README.md').includes(`](${pkg.homepage})`), 'README links to package homepage')
  for (let path of htmlFiles) {
    let canonical = documentOf(path).querySelector('link[rel="canonical"]').getAttribute('href')
    ok(canonical.startsWith(pkg.homepage), `${path}: canonical uses package homepage`)
  }
})

test('every site page has essential metadata and semantic landmarks', () => {
  for (let path of htmlFiles) {
    let document = documentOf(path)
    is(document.documentElement.lang, 'en', `${path}: language`)
    ok(document.querySelector('meta[name="viewport"]'), `${path}: viewport`)
    ok(document.querySelector('meta[name="description"]')?.content.length > 40, `${path}: description`)
    ok(document.querySelector('link[rel="canonical"]'), `${path}: canonical`)
    is(document.querySelectorAll('h1').length, 1, `${path}: one h1`)
    ok(document.querySelector('main'), `${path}: main`)
    ok(document.querySelector('header'), `${path}: header`)
    ok(document.querySelector('footer'), `${path}: footer`)
    ok(document.querySelector('.skip-link'), `${path}: skip link`)
    ok(document.body.textContent.includes('AudioJS'), `${path}: AudioJS attribution`)
    for (let button of document.querySelectorAll('button')) is(button.type, 'button', `${path}: explicit button type`)
  }
})

test('example pages use one code block with honest runtime labels', () => {
  let web = read('examples/_web.js')
  ok(web.includes("import { AudioContext } from 'web-audio-api' // Node"))
  ok(web.includes('// Browser: remove the import; AudioContext is global.'))
  ok(web.includes('// CI: import OfflineAudioContext instead and render offline.'))
  for (let example of examples) {
    let path = `examples/${example.id}/index.html`
    let document = documentOf(path)
    is(document.body.dataset.example, example.id)
    is(document.querySelectorAll('[role="tab"]').length, 0, `${path}: no runtime tabs`)
    is(document.querySelectorAll('#example-code').length, 1, `${path}: one code block`)
    ok(document.querySelector('#example-code.language-javascript'))
    ok(document.querySelector('#demo-run'))
    ok(document.body.textContent.includes('native AudioContext'))
    ok(document.body.textContent.includes(example.command))
    ok(document.querySelector('script[type="application/ld+json"]'))
  }
})

test('all local HTML, CSS, JS, and navigation targets resolve', () => {
  let missing = []
  for (let path of htmlFiles) {
    let document = documentOf(path)
    for (let element of document.querySelectorAll('[href], [src]')) {
      let value = element.getAttribute('href') || element.getAttribute('src')
      let target = localTarget(path, value)
      if (target && !existsSync(target)) missing.push(`${path}: ${value}`)
    }
  }
  is(missing.join('\n'), '')
})

test('featured CLI wrappers consume shared portable graph cores', () => {
  let wrappers = ['tone', 'sweep', 'dtmf', 'stereo-test', 'lfo', 'spatial', 'speaker', 'linked-params', 'fft', 'render-to-buffer', 'process-file']
  for (let id of wrappers) ok(read(`examples/${id}.js`).includes("from './_portable.js'"), `${id} shared core`)
})

test('every portable graph core renders finite audible samples', async () => {
  let sampleRate = 44100
  let length = Math.ceil(sampleRate * 0.12)
  let options = {
    impulse: { count: 1 },
    dtmf: { digits: '5', speed: 0.06 },
    'stereo-test': { durationPerChannel: 0.06, gap: 0.01 },
    metronome: { pattern: 'X', bars: 1, bpm: 600 },
    sequencer: { loops: 1, bpm: 600 },
  }

  for (let id of Object.keys(portableBuilders)) {
    let ctx = new OfflineAudioContext(2, length, sampleRate)
    let graph = buildPortable(id, ctx, { duration: 0.1, when: 0, ...options[id] })
    let audio = await ctx.startRendering()
    let peak = 0
    let energy = 0
    let finite = true

    for (let channel = 0; channel < audio.numberOfChannels; channel++) {
      for (let sample of audio.getChannelData(channel)) {
        finite &&= Number.isFinite(sample)
        peak = Math.max(peak, Math.abs(sample))
        energy += sample * sample
      }
    }

    ok(graph.sources.length > 0, `${id}: scheduled a source`)
    is(audio.length, length, `${id}: rendered the requested frame count`)
    ok(finite, `${id}: samples are finite`)
    ok(peak > 1e-7, `${id}: output has a nonzero peak`)
    ok(peak <= 1, `${id}: output stays within the demo safety ceiling`)
    ok(energy > 1e-10, `${id}: output has nonzero energy`)
  }
})

test('seeded portable graphs repeat A and distinguish B', async () => {
  let render = async seed => {
    let ctx = new OfflineAudioContext(1, 256, 44100)
    buildPortable('noise', ctx, { color: 'white', duration: 256 / 44100, seed, when: 0 })
    return Array.from((await ctx.startRendering()).getChannelData(0))
  }
  let a1 = await render(17)
  let a2 = await render(17)
  let b = await render(18)
  is(a1.join(','), a2.join(','), 'same seed reproduces every sample')
  ok(a1.some((sample, index) => sample !== b[index]), 'different seed changes the output')
})

test('processed-buffer core renders the smallest valid input', async () => {
  let ctx = new OfflineAudioContext(1, 128, 44100)
  let input = ctx.createBuffer(1, 1, 44100)
  input.getChannelData(0)[0] = 0.5
  let graph = buildProcessedBuffer(ctx, input, { when: 0 })
  let samples = (await ctx.startRendering()).getChannelData(0)
  is(graph.duration, 1 / 44100, 'graph duration matches the one-sample input')
  ok(samples.every(Number.isFinite), 'one-sample output is finite')
  ok(samples.some(sample => sample !== 0), 'one-sample input survives the processing graph')
})

test('portable cleanup leaves only the final replacement audible', async () => {
  let render = async withCleanup => {
    let ctx = new OfflineAudioContext(1, 1024, 44100)
    if (withCleanup) {
      stopPortable(null)
      let first = buildPortable('tone', ctx, { duration: 0.01, when: 0 })
      stopPortable(first)
      stopPortable(first)
      let repeated = buildPortable('tone', ctx, { frequency: 220, duration: 0.01, when: 0 })
      stopPortable(repeated)
    }
    buildPortable('sweep', ctx, { from: 100, to: 500, mode: 'linear', duration: 1024 / 44100, gain: 0.2, when: 0 })
    return Array.from((await ctx.startRendering()).getChannelData(0))
  }

  let afterCleanup = await render(true)
  let replacementOnly = await render(false)
  is(afterCleanup.join(','), replacementOnly.join(','), 'null, repeated stop, A → A, and A → B leave only B')
  ok(afterCleanup.some(sample => sample !== 0), 'replacement output remains audible')
  let ctx = new OfflineAudioContext(1, 128, 44100)
  throws(() => buildPortable('missing', ctx), /No portable graph is registered/)
})

test('unsafe listening demos carry explicit safety language', () => {
  for (let id of ['sweep', 'impulse', 'stereo-test', 'binaural-beats', 'mic', 'recorder']) {
    let example = examples.find(item => item.id === id)
    ok(example.warning?.length > 30, `${id} warning metadata`)
    ok(documentOf(`examples/${id}/index.html`).querySelector('.warning'), `${id} rendered warning`)
  }
})

test('code blocks use MicroLighter with a plain-code fallback', () => {
  ok(read('syntax.js').includes('microlighter@2.1.0/dist/index.js'))
  for (let path of htmlFiles) {
    let document = documentOf(path)
    for (let code of document.querySelectorAll('pre > code')) {
      ok([...code.classList].some(name => name.startsWith('language-')), `${path}: code language`)
    }
  }
})

test('site CSS keeps the AudioJS token system and anti-slop constraints', () => {
  let css = read('site.css')
  let rules = css.replace(/\/\*[\s\S]*?\*\//g, '')
  ok(css.startsWith('/* Hallmark ·'))
  ok(!/transition\s*:\s*all\b/.test(rules), 'no transition-all')
  ok(!/\b100vw\b/.test(rules), 'no 100vw')
  ok(!/overflow-x\s*:\s*hidden/.test(rules), 'no overflow-x hidden')
  ok(!/#[0-9a-f]{3,8}\b/i.test(rules), 'no improvised hex colors')
  ok(!/\b(?:rgb|hsl|oklch)\(/i.test(rules), 'raw colors stay in tokens.css')
  ok(!/font-family\s*:(?!\s*var\()/i.test(rules), 'font families use tokens')
  ok(read('tokens.css').includes('--font-display: "Geist"'))
  ok(read('tokens.css').includes('--font-brand: "Orbitron"'))
  is((rules.match(/font-family:\s*var\(--font-brand\)/g) || []).length, 1, 'Orbitron is used only by the logo')
  ok(rules.includes('overflow-x: clip'))
  ok(rules.includes('prefers-reduced-motion'))
  ok(rules.includes(':focus-visible'))
})

test('site avoids autoplay, fabricated proof, and generic interaction copy', () => {
  let html = htmlFiles.map(read).join('\n')
  ok(!/\bautoplay\b/i.test(html), 'no autoplay')
  ok(!/>\s*Click here\s*</i.test(html), 'no click-here links')
  ok(!/trusted by|10× faster|99\.9% uptime/i.test(html), 'no invented marketing metrics')
  ok(!/Jane Doe|John Smith|Lorem Ipsum/i.test(html), 'no placeholder identities')
})
