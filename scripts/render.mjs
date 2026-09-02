#!/usr/bin/env node
// Builds the generated blocks of index.html by running the audio itself:
//   hero-code      the hero file, numbered
//   hero-graph     the node graph the hero file connects, recorded by running it
//   hero-wave      the hero file's rendered output: envelopes and spectrum
//   home-examples  the catalogue: sounding examples drawn from their own offline
//                  render, input and API examples wearing a designed grille
// Everything is produced by web-audio-api in Node; the grilles are the only hand-drawn marks.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import rfft from 'fourier-transform'
import { AudioWorkletNode, OfflineAudioContext } from '../index.js'
import { examples } from '../examples/catalog.js'
import { graphBuilders } from '../examples/graphs/index.js'
import { collapseGraph, graphSVG, recordConnections, resolveGraph } from '../graph.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RATE = 44100
const HERO = 'hero.js'
const HERO_SECONDS = 3
const BINS = 16
const FRAME = 4096

const escapeHTML = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
const r = value => Math.round(value * 10) / 10
const kHz = value => value >= 1000 ? `${r(value / 1000)} kHz` : `${r(value)} Hz`
const channelsOf = audio => Array.from({ length: audio.numberOfChannels }, (_, c) => audio.getChannelData(c))

// render an example offline for `duration` seconds with its options
async function render(id, { duration = 3, ...options } = {}) {
  let ctx = new OfflineAudioContext(2, Math.ceil(RATE * duration), RATE)
  await graphBuilders[id](ctx, { when: 0, AudioWorkletNodeClass: AudioWorkletNode, ...options, duration })
  return ctx.startRendering()
}

// per-bin reduction over the channels of a render
function bins(audio, n, reduce) {
  let channels = channelsOf(audio)
  let size = Math.floor(audio.length / n)
  return Array.from({ length: n }, (_, i) => reduce(channels, i * size, size))
}

const peak = (channels, from, size) => {
  let max = 0
  for (let data of channels) for (let i = from; i < from + size; i++) max = Math.max(max, Math.abs(data[i]))
  return max
}

const mix = (channels, i) => {
  let sum = 0
  for (let data of channels) sum += data[i] || 0
  return sum / channels.length
}

const rms = (channels, from, size) => {
  let sum = 0
  for (let i = from; i < from + size; i++) sum += mix(channels, i) ** 2
  return Math.sqrt(sum / size)
}

// Hann-windowed magnitude spectrum of the mono mix; rfft reuses its own
// buffer unless given one, so every call gets a fresh array
function magnitudes(channels, from, size = FRAME) {
  let frame = new Float32Array(size)
  for (let i = 0; i < size; i++) frame[i] = mix(channels, from + i) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / size))
  return rfft(frame, new Float32Array(size / 2))
}

const hz = (bin, size = FRAME) => bin * RATE / size
const logPos = (f, lo, hi) => Math.log(f / lo) / Math.log(hi / lo)

// magnitude spectrum averaged over up to `frames` windows, folded into log-spaced
// bins by their mean so a narrow notch survives, over `range` dB
function spectrumBins(audio, n, { lo = 40, hi = 16000, range = 60, frames = Infinity, channels = channelsOf(audio) } = {}) {
  let sum = new Float64Array(FRAME / 2)
  let count = 0
  for (let from = Math.floor(audio.length * 0.3); from + FRAME <= audio.length && count < frames; from += FRAME / 2, count++) {
    let mags = magnitudes(channels, from)
    for (let i = 0; i < sum.length; i++) sum[i] += mags[i]
  }
  let folded = new Float64Array(n), members = new Float64Array(n)
  for (let bin = 1; bin < sum.length; bin++) {
    let pos = logPos(hz(bin), lo, hi)
    if (pos < 0 || pos >= 1) continue
    let k = Math.floor(pos * n)
    folded[k] += sum[bin] / count
    members[k]++
  }
  for (let k = 0; k < n; k++) if (members[k]) folded[k] /= members[k]
  let top = Math.max(...folded)
  return Array.from(folded, value => value ? Math.max(0, 1 + 20 * Math.log10(value / top) / range) : 0)
}

// the strongest spectral peaks of each time bin: a sparse spectrogram
function tracePeaks(audio, n, { lo = 40, hi = 8000, size = 2048, channels = channelsOf(audio) } = {}) {
  let step = Math.floor(audio.length / n)
  let frames = Array.from({ length: n }, (_, i) => magnitudes(channels, Math.max(0, Math.min(i * step + (step - size >> 1), audio.length - size)), size))
  let top = Math.max(...frames.map(mags => Math.max(...mags))) || 1
  return frames.map(mags => {
    let peaks = []
    for (let bin = 2; bin < mags.length - 1; bin++) {
      let f = hz(bin, size)
      if (f < lo || f > hi || mags[bin] < top * 0.08 || mags[bin] <= mags[bin - 1] || mags[bin] < mags[bin + 1]) continue
      peaks.push({ f, level: mags[bin] / top })
    }
    return peaks.sort((a, b) => b.level - a.level).slice(0, 4)
  })
}

// a few cycles of the waveform once the sound has settled, resampled to `points`
function waveformCycles(audio, points, cycles = 3) {
  let channels = channelsOf(audio)
  let from = Math.floor(audio.length * 0.3)
  let mags = magnitudes(channels, from)
  let best = 0
  for (let bin = 1; bin < mags.length; bin++) if (hz(bin) >= 30 && hz(bin) <= 2000 && mags[bin] > mags[best]) best = bin
  let span = (best ? RATE / hz(best) : FRAME / 4) * cycles
  let samples = Array.from({ length: points }, (_, i) => {
    let t = from + i / (points - 1) * span
    let k = Math.floor(t), a = mix(channels, k), b = mix(channels, k + 1)
    return a + (b - a) * (t - k)
  })
  let top = Math.max(...samples.map(Math.abs)) || 1
  return samples.map(value => value / top)
}

const bar = (x, mid, half) => `M${x} ${r(mid - half)}V${r(mid + half)}`
// Thumbnails: one square, one lattice, one stroke. Every example is bars,
// dashes, and dots on the same grid; no curves. Sounding examples are drawn from
// their own render with level in dB so tails keep their mass; API and input
// examples wear a grille. Sixteen columns, fifteen rows, the axis on the middle row.
const BOX = 96, PITCH = 6, ROWS = 15
const col = k => PITCH / 2 + k * PITCH
const row = j => PITCH + j * PITCH
const MID = row((ROWS - 1) / 2)
const svg = (kind, body) => `<svg class="example-thumb thumb-${kind}" viewBox="0 0 ${BOX} ${BOX}" aria-hidden="true">${body}</svg>`
// round-capped strokes, a zero-length stroke being a dot
const strokes = segments => `<path d="${segments.map(([x1, y1, x2, y2]) => `M${r(x1)} ${r(y1)}` + (x1 === x2 && y1 === y2 ? 'h.01' : `L${r(x2)} ${r(y2)}`)).join('')}"/>`
const dot = (x, y) => [x, y, x, y]
const dash = (k, y) => [col(k) - 1, y, col(k) + 1, y]
// a vertical bar between two heights snapped to the lattice, a dot where they meet
const snap = y => row(Math.max(0, Math.min(ROWS - 1, Math.round((y - PITCH) / PITCH))))
const column = (x, from, to) => { let a = snap(from), b = snap(to); return [a === b ? dot(x, a) : [x, a, x, b]] }
const dB = (value, top, range = 48) => value > 0 ? Math.max(0, 1 + 20 * Math.log10(value / top) / range) : 0
const lattice = keep => {
  let points = []
  for (let i = 0; i < BINS; i++) for (let j = 0; j < ROWS; j++) if (keep(col(i) - BOX / 2, row(j) - BOX / 2, i, j)) points.push(dot(col(i), row(j)))
  return points
}
const disc = (x, y) => Math.hypot(x, y) <= 45

// Braun grilles: the examples about input, output, and the API
const grilles = {
  // a needle over a scale of ticks
  tuner: () => [[48, row(1), 48, row(10)], ...Array.from({ length: BINS }, (_, i) => [col(i), row(12), col(i), row(i % 4 ? 13 : 14)])],
  // dots along rays
  'latency-tester': () => [dot(48, 48), ...[12, 24, 36, 45].flatMap(radius => Array.from({ length: 12 }, (_, k) => dot(48 + radius * Math.cos(k * Math.PI / 6), 48 + radius * Math.sin(k * Math.PI / 6))))],
  // two upright meters of horizontal lines
  'level-meter': () => Array.from({ length: ROWS }, (_, j) => [[21, row(j), 45, row(j)], [51, row(j), 75, row(j)]]).flat(),
  // the lattice inside a rounded rectangle
  mic: () => lattice((x, y) => Math.abs(x) <= 45 && Math.abs(y) <= 27 && (Math.abs(x) <= 30 || Math.abs(y) <= 12 || Math.hypot(Math.abs(x) - 30, Math.abs(y) - 12) <= 15)),
  // record: horizontal lines filling a disc
  recorder: () => Array.from({ length: ROWS }, (_, j) => { let half = Math.sqrt(45 ** 2 - (row(j) - 48) ** 2); return [48 - half, row(j), 48 + half, row(j)] }),
  // the speaker grille: the lattice inside a circle
  speaker: () => lattice(disc),
  // bars whose heights ride a slow wave
  lfo: () => Array.from({ length: BINS }, (_, i) => { let half = 21 + 21 * Math.sin(i * Math.PI / 4); return column(col(i), 48 - half, 48 + half) }).flat(),
  // diagonal stripes of dots: a source on the move
  spatial: () => lattice((x, y, i, j) => (i + j) % 4 === 0),
  // a checkerboard inside a square: a processor
  worklet: () => lattice((x, y, i, j) => (i + j) % 2 === 0 && Math.abs(x) <= 39 && Math.abs(y) <= 39),
  // one bar feeding three lines
  'linked-params': () => [[col(3), row(1), col(3), row(13)], ...[3, 7, 11].map(j => [col(5), row(j), col(13), row(j)])],
  // a comb of bars stepping down, dots along the floor
  fft: () => [...Array.from({ length: BINS }, (_, i) => dot(col(i), row(ROWS - 1))), ...[1, 4, 7, 10, 13].map((i, n) => [col(i), row(2 * n), col(i), row(ROWS - 1)])],
  // horizontal lines inside a rounded rectangle: a buffer
  'render-to-buffer': () => Array.from({ length: 13 }, (_, n) => { let j = n + 1, inset = j === 1 || j === 13 ? 30 : 24; return [inset, row(j), 96 - inset, row(j)] }),
  // lines of a document, the last one short
  'process-file': () => [2, 4, 6, 8, 10, 12].map(j => [24, row(j), j === 12 ? 54 : 72, row(j)]),
  // staggered dashes: a stream
  'pipe-stdout': () => Array.from({ length: 8 }, (_, n) => n * 2).flatMap(j => Array.from({ length: 4 }, (_, c) => c * 4 + (j / 2 % 2) * 2).filter(c => c + 2 < BINS).map(c => [col(c), row(j), col(c + 2), row(j)])),
  // horizontal lines shortening row by row: a tail
  reverb: () => Array.from({ length: ROWS }, (_, j) => [24, row(j), 24 + 48 * (1 - j / (ROWS - 1)), row(j)]).map(([x1, y, x2]) => x2 - x1 < 1 ? dot(x1, y) : [x1, y, x2, y]),
}

// which projection of its render each sounding example gets; unlisted ones show their envelope
const looks = {
  tone: 'shape', additive: 'shape', 'fm-synthesis': 'shape', wavetable: 'shape', 'missing-fundamental': 'shape', 'binaural-beats': 'shape', beating: 'shape',
  noise: 'spectrum', 'huggins-pitch': 'spectrum', 'zwicker-tone': 'spectrum',
  sweep: 'roll', shepard: 'roll', 'tritone-paradox': 'roll', 'scale-illusion': 'roll', streaming: 'roll', sequencer: 'roll', serial: 'roll', dtmf: 'roll', jazz: 'roll', gamelan: 'roll', drone: 'roll',
  'octave-illusion': 'ears',
  'stereo-test': 'pan',
  'risset-rhythm': 'raster', euclidean: 'raster',
}
// how long to look, how to set the example up, and how to read it, so its idiom lands on the lattice
const settings = {
  // a second and a half of eighth-note clicks at 80 bpm: a bar every fourth column, |...|...|...|...
  metronome: { bpm: 80, pattern: 'Xxxx', range: 18, duration: 1.5 },
  impulse: { count: 1 },
  dtmf: { speed: 0.3, duration: 3.6 },
  noise: { frames: 1 },
  'huggins-pitch': { difference: true, range: 24 },
  'zwicker-tone': { range: 16 },
  'scale-illusion': { duration: 2.4 },
  // one crossing of the three-octave tempo window: the beat doubles, and doubles again
  'risset-rhythm': { duration: 18 },
  // sixteen sixteenths at 120 bpm: one bar per row, so the pattern repeats down the rows
  euclidean: { duration: 30, tempo: 120 },
}
const seconds = { shape: 2, spectrum: 2 }

// the pitch range a set of frames actually uses, from the strongest peak of each
function rangeOf(...frameSets) {
  let leads = frameSets.flat().map(peaks => peaks[0]?.f).filter(Boolean)
  return leads.length ? { lo: Math.min(...leads), hi: Math.max(...leads) } : null
}

// a piano roll: a dash per column at each sounding pitch, on `rows` rows from row `offset`
function roll(frames, range, rows = ROWS, offset = 0) {
  if (!range) return []
  let place = f => range.hi === range.lo ? (rows - 1) / 2 : Math.log(f / range.lo) / Math.log(range.hi / range.lo) * (rows - 1)
  return frames.flatMap((peaks, k) => [...new Set(peaks.slice(0, 2).filter(p => p.f >= range.lo && p.f <= range.hi).map(p => Math.round(place(p.f))))].map(j => dash(k, row(offset + rows - 1 - j))))
}

// the projections of a render onto the lattice, as stroke segments
export const draw = {
  // a few cycles of the waveform: a bar from the axis to the sample
  shape: audio => waveformCycles(audio, BINS, 2).flatMap((v, k) => column(col(k), MID, MID - v * 42)),
  // level over frequency: a bar from the floor; `difference` reads what one ear has that the other lacks
  spectrum: (audio, { frames, range = 48, difference } = {}) => {
    let [left, right] = channelsOf(audio)
    let channels = difference ? [Float32Array.from(left, (v, i) => v - right[i])] : undefined
    return spectrumBins(audio, BINS, { range, frames, channels }).flatMap((v, k) => column(col(k), row(ROWS - 1), row(ROWS - 1) - v * 84))
  },
  // pitch over time, the range fitted to the notes
  roll: audio => { let frames = tracePeaks(audio, BINS); return roll(frames, rangeOf(frames)) },
  // pitch over time per ear: left above the axis, right below
  ears: audio => {
    let [left, right] = channelsOf(audio)
    let a = tracePeaks(audio, BINS, { channels: [left] }), b = tracePeaks(audio, BINS, { channels: [right] })
    let range = rangeOf(a, b), half = (ROWS - 1) / 2
    return [...roll(a, range, half, 0), ...roll(b, range, half, half + 1)]
  },
  // position in the stereo field over time, time running down the rows
  pan: audio => {
    let [left, right] = channelsOf(audio)
    let l = bins(audio, ROWS, (channels, from, size) => peak([left], from, size))
    let rr = bins(audio, ROWS, (channels, from, size) => peak([right], from, size))
    let top = Math.max(...l, ...rr) || 1
    return l.flatMap((lv, j) => dB(Math.max(lv, rr[j]), top) ? [dash(Math.round(rr[j] / (lv + rr[j]) * (BINS - 1)), row(j))] : [])
  },
  // time scanned row by row, a dot per onset: rhythm as a pattern of dots
  raster: audio => {
    let levels = bins(audio, BINS * ROWS, peak), top = Math.max(...levels) || 1
    let loud = levels.map(v => dB(v, top))
    return loud.flatMap((v, n) => v >= 0.5 && v - (loud[n - 1] ?? 0) >= 0.125 ? [dot(col(n % BINS), row(Math.floor(n / BINS)))] : [])
  },
  // the envelope: left channel above the axis, right channel below
  wave: (audio, { range } = {}) => {
    let side = c => bins(audio, BINS, (channels, from, size) => peak([channels[Math.min(c, channels.length - 1)]], from, size))
    let left = side(0), right = side(1), top = Math.max(...left, ...right) || 1
    return left.flatMap((v, k) => column(col(k), MID - dB(v, top, range) * 42, MID + dB(right[k], top, range) * 42))
  },
}

async function thumb(id) {
  if (grilles[id]) return svg('input', strokes(grilles[id]()))
  let kind = looks[id] ?? 'wave', setup = settings[id] ?? {}
  return svg(kind, strokes(draw[kind](await render(id, { duration: seconds[kind] ?? 3, ...setup }), setup)))
}

// Run the hero file against a recording context: every connect() it makes is
// kept, then the same context renders its output.
export async function runHero(source, seconds) {
  let probe = new OfflineAudioContext(1, 1, RATE)
  let proto = probe.createGain()
  while (!Object.hasOwn(proto, 'connect')) proto = Object.getPrototypeOf(proto)
  let contexts = []
  globalThis.__recordingAudioContext = class extends OfflineAudioContext {
    constructor() { super(2, Math.ceil(RATE * seconds), RATE); contexts.push(this) }
    resume() { return Promise.resolve() }
    close() { return Promise.resolve() }
  }
  // the source and a shim standing in for the package, as files: every runtime imports files, and Bun
  // hands back an empty module for a data: URL; modules are cached by URL, so a fresh directory runs both again
  let dir = mkdtempSync(join(tmpdir(), 'hero-'))
  writeFileSync(join(dir, 'web-audio-api.js'), 'export const AudioContext = globalThis.__recordingAudioContext\n')
  writeFileSync(join(dir, 'hero.js'), source.replace(/(['"])web-audio-api\1/, "'./web-audio-api.js'"))
  let edges
  try {
    edges = await recordConnections(proto, () => import(pathToFileURL(join(dir, 'hero.js')).href))
  } finally {
    delete globalThis.__recordingAudioContext
    rmSync(dir, { recursive: true, force: true })
  }
  if (!contexts.length) throw new Error(`${HERO} never constructed an AudioContext`)
  let audio = await contexts[0].startRendering()
  return { audio, ...resolveGraph(edges) }
}

function codeHTML(source) {
  let lines = source.trimEnd().split('\n')
  return `<pre><span class="lines" aria-hidden="true">${lines.map((_, i) => String(i + 1).padStart(2, '0')).join('\n')}</span><code class="language-javascript" id="hero-code">${escapeHTML(lines.join('\n'))}</code></pre>`
}

function artHTML(audio, seconds) {
  // one bar system for both: 100 bars, four units apart
  let count = 100, x = i => 2 + i * 4, width = count * 4
  let peaks = bins(audio, count, peak), levels = bins(audio, count, rms)
  let top = Math.max(...peaks) || 1
  let layer = values => values.map((v, i) => bar(x(i), 110, Math.max(0.5, v / top * 106))).join('')
  let wave = `<svg class="hero-wave" viewBox="0 0 ${width} 220" preserveAspectRatio="none" aria-hidden="true"><path class="wave-peak" d="${layer(peaks)}"/><path class="wave-rms" d="${layer(levels)}"/></svg>`
  let values = spectrumBins(audio, count)
  let spec = `<svg class="hero-spectrum" viewBox="0 0 ${width} 220" preserveAspectRatio="none" aria-hidden="true"><path d="${values.map((v, i) => `M${x(i)} 220V${r(220 - Math.max(1, v * 106))}`).join('')}"/></svg>`
  let row = (a, b) => `<div class="art-row"><span>${a}</span><span>${b}</span></div>`
  return [`<div class="art-row"><span class="art-end">${audio.numberOfChannels} ch, ${kHz(audio.sampleRate)}</span></div>`, wave, row('0 s', `${seconds} s`), spec, row('40 Hz', '16 kHz')].join('\n        ')
}

function entryHTML(example, thumbSVG) {
  let number = String(examples.indexOf(example) + 1).padStart(2, '0')
  return `<a class="example-entry" href="./examples/${escapeHTML(example.id)}/" data-open-example="${escapeHTML(example.id)}"><span class="example-number">${number}</span><span class="example-heading"><strong>${escapeHTML(example.title)}</strong></span><svg class="example-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg><span class="example-description">${escapeHTML(example.description)}</span><small class="example-tag">${escapeHTML(example.job)}</small>${thumbSVG}</a>`
}

async function examplesHTML() {
  let thumbs = new Map()
  for (let example of examples) thumbs.set(example.id, await thumb(example.id))
  let categories = [...new Set(examples.map(example => example.category))]
  return categories.map(category => {
    let entries = examples.filter(example => example.category === category)
      .map(example => '            ' + entryHTML(example, thumbs.get(example.id))).join('\n')
    return `        <section class="example-group" id="${category.toLowerCase().replace(/\s+/g, '-')}"><h3>${escapeHTML(category)}</h3><div class="example-grid">\n${entries}\n          </div></section>`
  }).join('\n')
}

function replaceGenerated(source, name, content) {
  let start = `<!-- GENERATED:${name}:start -->`
  let end = `<!-- GENERATED:${name}:end -->`
  let from = source.indexOf(start), to = source.indexOf(end)
  if (from < 0 || to < 0) throw new Error(`Missing generated markers for ${name}`)
  return source.slice(0, from + start.length) + '\n' + content + '\n' + source.slice(to)
}

// as a script: rebuild index.html; as a module: the recorder is importable for tests
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let heroSource = readFileSync(join(root, HERO), 'utf8')
  let { audio, nodes, edges } = await runHero(heroSource, HERO_SECONDS)
  let path = join(root, 'index.html')
  let html = readFileSync(path, 'utf8')
  html = replaceGenerated(html, 'hero-code', '          ' + codeHTML(heroSource.replace(/^(\/\/.*\n)+\n?/, '')))
  let folded = collapseGraph(nodes, edges)
  html = replaceGenerated(html, 'hero-graph', '        ' + graphSVG(folded.nodes, folded.edges, 'The graph hero.js connects', folded.counts))
  html = replaceGenerated(html, 'hero-wave', '        ' + artHTML(audio, HERO_SECONDS))
  html = replaceGenerated(html, 'home-examples', await examplesHTML())
  writeFileSync(path, html)
  process.stdout.write(`${HERO}: ${nodes.length} nodes, ${edges.length} connections; ${examples.length} example thumbnails; written to index.html\n`)
  // some graphs leave a scheduling timer behind; the renders are done
  process.exit(0)
}
