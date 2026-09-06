// Offline listening fixtures. No device is opened; levels are not normalized per file.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { OfflineAudioContext } from '../index.js'
import { init as jazz, styles, leads } from '../examples/graphs/jazz.js'
import { init as drone } from '../examples/graphs/drone.js'
import { createInstrument, soundNames } from '../examples/graphs/metronome.js'

const directory = 'build/music'
mkdirSync(directory, { recursive: true })
const rate = 44100, seed = 17, reports = []
const preferred = { ambient: 'harp', nordic: 'flute', ballad: 'piano' }
const fixtures = [
  ...Object.keys(styles).map(style => ({ name: `jazz-${style}`, type: 'jazz', duration: 20, options: { style, lead: preferred[style] || 'guitar' } })),
  ...leads.map(lead => ({ name: `solo-${lead}`, type: 'jazz', solo: true, duration: 12, options: { style: 'bossa', lead, bpm: 120 } })),
  ...['tanpura', 'pad', 'shruti', 'harmonic', 'strings'].map(voice => ({ name: `drone-${voice}`, type: 'drone', duration: 12, options: { voice } })),
  { name: 'drone-strings-melody', type: 'drone', duration: 16, options: { voice: 'strings', melody: 'pentatonic' } },
  ...soundNames.map(sound => ({ name: `metronome-${sound}`, type: 'metronome', duration: 2, options: { sound } })),
]
for (const fixture of fixtures) {
  const ctx = new OfflineAudioContext(2, Math.ceil(rate * fixture.duration), rate)
  const options = { ...fixture.options, duration: fixture.duration, seed, when: 0 }
  if (fixture.type === 'jazz') {
    const graph = await jazz(ctx, options)
    if (fixture.solo) {
      graph.data.stems.bass.gain.value = 0; graph.data.stems.comp.gain.value = 0
      for (const node of graph.data.stems.drums) node.disconnect()
    }
  } else if (fixture.type === 'drone') drone(ctx, options)
  else {
    const instrument = createInstrument(ctx, options)
    for (let beat = 0; beat < 4; beat++) instrument.hit(0.05 + beat * 0.5, beat ? 'x' : 'X')
  }
  const start = performance.now()
  const audio = await ctx.startRendering()
  const renderMs = performance.now() - start
  const channels = [audio.getChannelData(0), audio.getChannelData(1)]
  const wav = Buffer.alloc(44 + audio.length * 4)
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22)
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34)
  wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40)
  let peak = 0, energy = 0
  for (let i = 0; i < audio.length; i++) for (let ch = 0; ch < 2; ch++) {
    const sample = channels[ch][i]
    if (!Number.isFinite(sample) || Math.abs(sample) > 1) throw Error(`${fixture.name}: invalid or clipped sample at ${i}`)
    peak = Math.max(peak, Math.abs(sample)); energy += sample * sample
    wav.writeInt16LE(Math.round(sample * 32767), 44 + (i * 2 + ch) * 2)
  }
  writeFileSync(join(directory, `${fixture.name}.wav`), wav)
  reports.push({ ...fixture, seed, rate, frames: audio.length, renderMs, peak, rms: Math.sqrt(energy / (audio.length * 2)) })
  console.log(`${fixture.name}: peak ${peak.toFixed(3)}`)
}
writeFileSync(join(directory, 'results.json'), JSON.stringify(reports, null, 2) + '\n')
console.log(`Listening fixtures: ${directory}/`)
