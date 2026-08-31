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
const redirectPages = ['examples/index.html', ...examples.map(example => `examples/${example.id}/index.html`)]
const htmlFiles = ['index.html', ...guidePages, ...redirectPages]

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
  is(examples.length, 33)
  is(new Set(examples.map(example => example.id)).size, examples.length)
  let sourceIds = readdirSync(join(root, 'examples'), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.js') && !['browser.js', 'catalog.js', 'options.js', 'tuner-pitch.js', 'utils.js'].includes(entry.name))
    .map(entry => entry.name.slice(0, -3))
    .sort()
  is(sourceIds.join(','), examples.map(example => example.id).sort().join(','))
  for (let example of examples) {
    ok(existsSync(join(root, 'examples', `${example.id}.js`)), `${example.id} CLI`)
    ok(existsSync(join(root, 'examples', 'graphs', `${example.id}.js`)), `${example.id} graph`)
    ok(existsSync(join(root, 'examples', example.id, 'index.html')), `${example.id} compatibility route`)
    ok(example.command.startsWith('node examples/'), `${example.id} command`)
  }
})

test('homepage is only the headless hero, example catalogue, compact FAQ, and footer', () => {
  let document = documentOf('index.html')
  is(document.querySelector('#hero-title strong').textContent, 'Web Audio API')
  is(document.querySelector('#hero-title span').textContent, 'headless')
  is(document.querySelectorAll('header a').length, 1, 'only the GitHub corner action')
  ok(document.querySelector('header a[href="https://github.com/audiojs/web-audio-api"]'))
  is(document.querySelectorAll('header nav').length, 0)
  is(document.querySelector('.install-command').textContent.trim(), 'npm install web-audio-api')
  is(document.querySelectorAll('.install-command button').length, 0, 'install command has no copy button')
  ok(!document.body.textContent.includes('Basic usage'))
  is(document.querySelector('.hero-code [data-copy]').textContent.trim(), '', 'code copy is icon-only')
  is([...document.querySelectorAll('main > section > .section-heading h2')].map(node => node.textContent).join('|'), 'Examples|Questions')
  is(document.querySelectorAll('[data-open-example]').length, examples.length)
  is(document.querySelectorAll('.example-group').length, 5, 'examples are grouped by kind')
  for (let link of document.querySelectorAll('[data-open-example]')) ok(link.getAttribute('href').startsWith('./examples/'), 'example remains a crawlable link')
  ok(document.querySelector('dialog#example-dialog'))
  is(document.querySelectorAll('[role="tab"]').length, 0)
  let questions = [...document.querySelectorAll('.faq summary')].map(node => node.textContent.trim())
  for (let expected of ['Is it fast enough for realtime?', 'How does audio I/O work?', 'Which formats can it decode?', 'Does Tone.js work?', 'Can I test audio in CI?', 'Can it run without speakers?', 'Does it support AudioWorklets?', 'What differs from a browser?', 'How does it compare?']) ok(questions.includes(expected), expected)
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
  ok(!pkg.dependencies['audio-decode'], 'unscoped alias removed')
  ok(read('src/utils.js').includes("from '@audio/decode'"))
  ok(read('README.md').includes(`](${pkg.homepage})`), 'README links to homepage')
  is(documentOf('index.html').querySelector('link[rel="canonical"]').href, pkg.homepage)
  let sitemap = read('sitemap.xml')
  is((sitemap.match(/<url>/g) || []).length, examples.length + 1, 'homepage and every example are indexed')
  for (let example of examples) ok(sitemap.includes(`${pkg.homepage}examples/${example.id}/`), `${example.id} sitemap URL`)
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
    ok(document.body.textContent.includes(example.command), `${example.id} CLI command`)
    ok(document.querySelector('script[type="application/ld+json"]'), `${example.id} structured data`)
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
    ok(!/^import\s/m.test(graph), `${example.id} source is atomic`)
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
  let expectedVoices = { classic: 3, wood: 4, bell: 4, beep: 2, signal: 1 }
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
  for (let sound of ['wood', 'bell', 'beep', 'signal']) ok(rendered.get(sound).some((sample, index) => sample !== rendered.get('classic')[index]), `${sound}: distinct from classic`)
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
  for (let id of ['sweep', 'impulse', 'stereo-test', 'binaural-beats', 'mic', 'recorder']) {
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
  ok(rules.includes('prefers-reduced-motion'))
  ok(rules.includes(':focus-visible'))
  ok(rules.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'), 'two-column example catalogue')
})

test('research and product decisions are documented', () => {
  ok(existsSync(join(root, 'website.md')))
  let research = read('website.md')
  for (let heading of ['## Users', '## Jobs and trigger moments', '## Positioning', '## Evidence', '## Alternatives', '## Open questions', '## Sources']) ok(research.includes(heading), heading)
})

test('site avoids autoplay, fabricated proof, and generic interaction copy', () => {
  let html = htmlFiles.map(read).join('\n')
  ok(!/\bautoplay\b/i.test(html))
  ok(!/>\s*Click here\s*</i.test(html))
  ok(!/trusted by|10× faster|99\.9% uptime/i.test(html))
  ok(!/Jane Doe|John Smith|Lorem Ipsum/i.test(html))
})
