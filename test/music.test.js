import test, { ok, is } from 'tst'
import { OfflineAudioContext, AudioWorkletNode } from '../index.js'
import { init as jazz, styles, leads } from '../examples/graphs/jazz.js'
import { init as drone } from '../examples/graphs/drone.js'
import { createInstrument, soundNames, init as metronome } from '../examples/graphs/metronome.js'
import assert from 'node:assert/strict'
import { buildGraph, graphBuilders } from '../examples/graphs/index.js'
import { detectPitch } from '../examples/tuner-pitch.js'

const sr = 22050
const peak = samples => samples.reduce((p, v) => Math.max(p, Math.abs(v)), 0)
const rms = samples => Math.sqrt(samples.reduce((e, v) => e + v * v, 0) / samples.length)

// Plan a long performance, but construct only the live lookahead window.
async function score(style, seed = 17) {
  const ctx = new OfflineAudioContext(2, 128, sr)
  ctx.startRendering = undefined
  try { return (await jazz(ctx, { style, seed, duration: 128, bpm: 120, when: 0, AudioWorkletNodeClass: AudioWorkletNode })).data }
  finally { ctx._state = 'closed' } // the lookahead timer releases itself at its next tick
}

test('jazz forms, bass feels and lead targets follow each style across full choruses', async () => {
  const allowed = {
    maj7: [0, 2, 4, 7, 11], 'maj7#11': [0, 2, 4, 6, 7, 11],
    m7: [0, 2, 3, 7, 10], m9: [0, 2, 3, 7, 10], m11: [0, 2, 3, 5, 7, 10],
    sus: [0, 2, 5, 7, 10], 7: [0, 2, 4, 7, 10], dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10],
  }
  const scores = {}
  for (const style of Object.keys(styles)) {
    const data = scores[style] = await score(style)
    const chordAt = position => data.chords.find(c => position >= c.start && position < c.start + c.beats)
    ok(data.leadNotes.length > 10, `${style}: full phrases, not just a first-bar render`)
    for (const n of data.leadNotes.filter(n => n.target)) {
      const c = chordAt(n.position + (n.anticipated ? 0.5 : 0))
      ok(allowed[c.quality].includes(((n.note - c.root) % 12 + 12) % 12), `${style}: target ${n.note} belongs to ${c.quality}, including anticipated changes`)
    }
    ok(new Set(data.leadNotes.map(n => n.note)).size >= 6, `${style}: melodic range`)
    ok(new Set(data.leadNotes.map(n => n.beats.toFixed(2))).size >= 3, `${style}: rhythmic vocabulary`)
    ok(data.leadNotes.every(n => n.position >= 0 && n.beats > 0 && n.position + n.beats <= 256), `${style}: phrases stay within the performance`)
    ok(data.compHits.every(c => new Set(c.notes).size === c.notes.length), `${style}: voicings do not collapse into duplicate pitches`)
    for (const n of data.bassNotes.filter(n => n.position % 4 === 0)) {
      const c = chordAt(n.position)
      const tones = ['swing', 'bossa', 'ballad', 'blues'].includes(style) ? allowed[c.quality].filter(pc => pc !== 2 && pc !== 5) : allowed[c.quality]
      ok(tones.includes(((n.note - c.root) % 12 + 12) % 12) || c.quality === 'sus', `${style}: downbeat bass supports the chord`)
    }
  }
  is(scores.swing.chordLog.length, 27, '32-bar AABA with an eight-bar dominant bridge')
  is(scores.blues.chordLog.length, 14, '12-bar jazz blues with a two-chord turnaround')
  ok(scores.modal.chords.every(c => c.beats === 16), 'modal harmony changes in four-bar plateaus')
  ok(scores.ambient.chords.some(c => c.beats === 32), 'ambient harmony holds eight bars')
  ok(scores.nordic.chords.some(c => c.quality === 'm9'), 'Nordic tonic uses the darker minor vocabulary')
  ok(scores.swing.leadNotes.some(n => n.tuplet), 'bebop triplets coexist with swung eighths')
  ok(scores.ballad.leadNotes.some(n => n.device === 'grace'), 'ballad grace notes precede phrases')
  ok(scores.blues.leadNotes.some(n => n.scoop), 'blues targets carry bends')
  ok(scores.bossa.bassNotes.some(n => n.position % 1 === 0.5), 'bossa bass anticipates the pulse')
  ok(scores.nordic.bassNotes.some(n => n.position % 1 === 0.5 && n.beats >= 2), 'Nordic bass has spacious offbeat answers')
  ok(JSON.stringify(scores.blues.bassNotes) !== JSON.stringify(scores.swing.bassNotes), 'shuffle riffs are not the swing walker')
  is(JSON.stringify((await score('swing')).leadNotes), JSON.stringify(scores.swing.leadNotes), 'motivic composition is seeded')
})

test('modal jazz has grounded swells and clocked chord names without AudioWorklet', async () => {
  const ctx = new OfflineAudioContext(2, 128, sr)
  ctx.startRendering = undefined
  Object.defineProperty(ctx, 'audioWorklet', { get() { throw Error('AudioWorklet must not be needed') } })
  try {
    const demo = await jazz(ctx, { seed: 17, style: 'modal', lead: 'flute', bpm: 120, duration: 128, when: 1 })
    assert.deepEqual(demo.data.chordLog, ['Cm9', 'Abmaj7', 'Ebmaj7', 'Bbsus', 'Cm9', 'Fm9', 'Gsus', 'Cm9'])
    assert.deepEqual([0, 1, 1, 9 - 1 / sr, 9, 17, 25, 33, 41, 49, 57, 65, 129].map(time => demo.readout(time)),
      ['', 'Cm9', 'Cm9', 'Cm9', 'Abmaj7', 'Ebmaj7', 'Bbsus', 'Cm9', 'Fm9', 'Gsus', 'Cm9', 'Cm9', ''], 'audio time selects A → A → B, including the exact chord boundary and end')
    assert.deepEqual(demo.data.compHits.slice(0, 4).map(hit => [hit.position, hit.beats, hit.notes]),
      [[0, 8, [48, 55, 63, 70, 74]], [8, 8, [48, 55, 63, 70, 74]], [16, 8, [44, 51, 60, 67, 70]], [24, 8, [44, 51, 60, 67, 70]]])
    for (const hit of demo.data.compHits) {
      is((hit.notes[0] - hit.chord.root + 120) % 12, 0, 'root anchors the voicing')
      is(hit.notes[1] - hit.notes[0], 7, 'open fifth below the colour tones')
      ok(hit.notes.every(note => note >= 43 && note <= 82), 'wide voicing stays in the instrument register')
    }
  } finally { ctx._state = 'closed' }
  // Smallest render, then repeated/different seeded audio: no worklet constructor supplied.
  for (const length of [1, sr]) {
    const outputs = []
    for (const seed of [17, 17, 18]) {
      const c = new OfflineAudioContext(2, length, sr)
      Object.defineProperty(c, 'audioWorklet', { get() { throw Error('AudioWorklet must not be needed') } })
      await jazz(c, { seed, duration: length / sr, lead: 'flute' })
      const data = (await c.startRendering()).getChannelData(0)
      ok(data.every(Number.isFinite), 'including the one-sample boundary')
      outputs.push(data)
    }
    assert.deepEqual(outputs[0], outputs[1], 'A → A renders the same samples')
    if (length > 1) { assert.notDeepEqual(outputs[0], outputs[2]); ok(rms(outputs[0]) > 0.005 && peak(outputs[0]) < 1, 'audible unclipped native-node render') }
  }
})

test('jazz instruments are tested after the lead enters, in isolation, at the written pitch', async () => {
  for (const lead of leads) {
    const ctx = new OfflineAudioContext(2, sr * 12.2, sr)
    const graph = await jazz(ctx, { style: 'bossa', lead, duration: 12, bpm: 120, seed: 11, AudioWorkletNodeClass: AudioWorkletNode })
    const { stems, leadNotes } = graph.data
    stems.bass.gain.value = 0; stems.comp.gain.value = 0
    for (const node of stems.drums) node.disconnect()
    const audio = (await ctx.startRendering()).getChannelData(0)
    const first = leadNotes[0], start = first.position * 0.5
    ok(peak(audio.subarray(0, Math.max(0, Math.floor(start * sr) - 64))) < 1e-8, `${lead}: accompaniment is inaudible before entry, allowing short FIR pre-ringing`)
    const window = audio.subarray(Math.floor((start + 0.05) * sr), Math.floor((start + 0.05) * sr) + 2048)
    const pitch = detectPitch(window, sr, { minFreq: 60, maxFreq: 2200, minRms: 0.0001 })
    const expected = 440 * 2 ** ((first.note - 69) / 12)
    ok(pitch && Math.abs(1200 * Math.log2(pitch.freq / expected)) < 40, `${lead}: fundamental matches MIDI ${first.note} (${pitch?.freq} vs ${expected} Hz)`)
    ok(rms(window) > 0.001, `${lead}: audible lead, not just unrelated drum noise`)
    ok(audio.every(Number.isFinite) && peak(audio) < 1, `${lead}: finite, unclipped`)
    ok(audio.subarray(sr * 12).every(v => v === 0), `${lead}: the master releases even long harp/room tails`)
  }
})

test('drone voices sustain, retune continuously, repeat by seed, and offer tonal melody', async () => {
  const renders = new Map()
  for (const voice of ['tanpura', 'pad', 'shruti', 'harmonic', 'strings']) {
    const ctx = new OfflineAudioContext(2, sr * 6, sr)
    const graph = drone(ctx, { voice, frequency: 130.8128, duration: 6, seed: 19, melody: 'pentatonic' })
    graph.data.retune(146.8324, 3)
    const buffer = await ctx.startRendering(), a = buffer.getChannelData(0), b = buffer.getChannelData(1)
    ok(a.every(Number.isFinite) && peak(a) < 1, `${voice}: finite, unclipped`)
    ok(rms(a.subarray(sr, sr * 4)) > 0.001, `${voice}: sustained energy`)
    ok(a.some((v, i) => v !== b[i]), `${voice}: stereo field is not dual mono`)
    ok(Math.abs(a[sr * 3] - a[sr * 3 - 1]) < 0.15, `${voice}: retune does not step the signal`)
    ok(graph.data.melody.every(n => [0, 2, 4, 7, 9].includes(n.interval) && n.time + n.length <= 6), `${voice}: melody stays in the pentatonic scale and duration`)
    renders.set(voice, a)
  }
  const ctx = new OfflineAudioContext(2, sr * 6, sr)
  const graph = drone(ctx, { voice: 'strings', frequency: 130.8128, duration: 6, seed: 19, melody: 'pentatonic' })
  graph.data.retune(146.8324, 3)
  const repeat = (await ctx.startRendering()).getChannelData(0)
  ok(repeat.every((v, i) => v === renders.get('strings')[i]), 'the full bowed ensemble repeats, including modulation and room')
  for (const [voice, samples] of renders) if (voice !== 'strings') ok(samples.some((v, i) => v !== repeat[i]), `${voice}: not the string ensemble with a different label`)
})

test('tanpura control-rate pitch settling stays close to the sample-rate reference', async () => {
  const render = async reference => {
    const ctx = new OfflineAudioContext(2, sr * 2, sr)
    const graph = drone(ctx, { voice: 'tanpura', duration: 2, seed: 17 })
    if (reference) for (const source of graph.sources) source.detune.automationRate = 'a-rate'
    return (await ctx.startRendering()).getChannelData(0)
  }
  const actual = await render(false), reference = await render(true)
  const error = actual.map((v, i) => v - reference[i])
  ok(rms(error) / rms(reference) < 0.03, 'pitch-control quantization stays below 3% RMS waveform error, without stepping amplitude envelopes')
})

test('metronome families have sample-timed onsets, audible accents, rests, and silent zero velocity', async () => {
  for (const sound of soundNames) {
    const ctx = new OfflineAudioContext(1, sr * 2, sr)
    const instrument = createInstrument(ctx, { sound, seed: 31, track: true })
    instrument.hit(0, '-', 1); instrument.hit(0, 'x', 0)
    instrument.hit(0.125, 'X'); instrument.hit(1, 'x')
    const samples = (await ctx.startRendering()).getChannelData(0)
    ok(samples.subarray(0, Math.floor(sr * 0.125)).every(v => v === 0), `${sound}: rests and zero velocity are silent`)
    ok(peak(samples.subarray(Math.ceil(sr * 0.125), Math.ceil(sr * 0.135))) > 0.01, `${sound}: attack occurs in the first 10 ms`)
    ok(rms(samples.subarray(sr * 0.125, sr * 0.225)) > rms(samples.subarray(sr, sr * 1.1)), `${sound}: accent is stronger than the regular hit`)
    ok(samples.every(Number.isFinite) && peak(samples) < 1, `${sound}: finite and unclipped`)
  }
})

test('musical option boundaries reject unbounded work and use safe preset fallbacks', async () => {
  for (const value of [0, -1, NaN, Infinity]) {
    const ctx = new OfflineAudioContext(1, 128, sr)
    await assert.rejects(jazz(ctx, { duration: value, AudioWorkletNodeClass: AudioWorkletNode }), RangeError)
    await assert.rejects(jazz(ctx, { duration: 1, bpm: value, AudioWorkletNodeClass: AudioWorkletNode }), RangeError)
    assert.throws(() => drone(ctx, { duration: value }), RangeError)
    assert.throws(() => drone(ctx, { frequency: value }), RangeError)
    if (value !== 0) assert.throws(() => metronome(ctx, { duration: value }), RangeError)
  }
  for (const preset of ['toString', '__proto__', null]) {
    const ctx = new OfflineAudioContext(2, 128, sr)
    const j = await jazz(ctx, { style: preset, lead: preset, duration: 0.1, AudioWorkletNodeClass: AudioWorkletNode })
    is(j.data.style, 'modal'); is(j.data.lead, 'guitar')
    is(drone(ctx, { voice: preset, duration: 0.1 }).data.voice, 'tanpura')
  }
  const empty = new OfflineAudioContext(1, 128, sr)
  is(metronome(empty, { duration: 0 }).sources.length, 0)
  ok((await empty.startRendering()).getChannelData(0).every(v => v === 0), 'zero-length metronome session is silent')
  const render = async bpm => {
    const ctx = new OfflineAudioContext(1, sr, sr)
    metronome(ctx, { bpm, duration: 1, seed: 7 })
    return (await ctx.startRendering()).getChannelData(0)
  }
  const normal = await render('80'), invalid = await render('80..Infinity')
  ok(normal.every((v, i) => v === invalid[i]), 'non-finite tempo endpoint falls back to a held tempo')
})

test('custom metronome samples preserve a one-frame attack and can be retriggered', async () => {
  const ctx = new OfflineAudioContext(1, sr, sr), sample = ctx.createBuffer(1, 1, sr)
  sample.getChannelData(0)[0] = 0.5
  const instrument = createInstrument(ctx, { sample })
  instrument.hit(0.125, 'x'); instrument.hit(0.5, 'x')
  const audio = (await ctx.startRendering()).getChannelData(0)
  for (const time of [0.125, 0.5]) {
    const expected = 0.5 * 0.65 * 0.7 * (1 - (Math.ceil(time * sr) - time * sr))
    ok(Math.abs(peak(audio.subarray(Math.floor(time * sr), Math.ceil(time * sr) + 4)) - expected) < 1e-7, 'one-frame attack preserves the resampled amplitude at fractional and integer start times')
  }
  ok(audio.subarray(0, Math.floor(0.125 * sr)).every(v => v === 0), 'no sample before its scheduled onset')
})

test('live schedulers survive pause, resume scheduling, and release ended note groups', async () => {
  const set = globalThis.setInterval, clear = globalThis.clearInterval
  const callbacks = new Map()
  globalThis.setInterval = callback => { const handle = {}; callbacks.set(handle, callback); return handle }
  globalThis.clearInterval = handle => { callbacks.delete(handle); clear(handle) }
  try {
    for (const id of ['jazz', 'drone', 'metronome']) {
      const ctx = new OfflineAudioContext(2, 128, sr)
      ctx.startRendering = undefined; ctx._state = 'running'
      const graph = await buildGraph(id, ctx, { duration: 30, seed: 17, style: 'bossa', when: 0, AudioWorkletNodeClass: AudioWorkletNode })
      const before = graph.sources.length, timers = callbacks.size
      ctx._state = 'suspended'
      for (const callback of callbacks.values()) callback()
      is(callbacks.size, timers, `${id}: suspension is not disposal`)
      is(graph.sources.length, before, `${id}: paused context schedules no new notes`)
      ctx._state = 'running'; ctx._frame = sr * 12
      for (const callback of callbacks.values()) callback()
      ok(graph.sources.length > before, `${id}: scheduling continues after resume`)
      for (const source of [...graph.sources]) source.dispatchEvent(new Event('ended'))
      ok(graph.sources.length <= 3, `${id}: completed voices are not retained for the whole performance`)
      ctx._state = 'closed'
      for (const callback of [...callbacks.values()]) callback()
      is(callbacks.size, 0, `${id}: closing releases scheduler timers`)
    }
  } finally { globalThis.setInterval = set; globalThis.clearInterval = clear }
})

test('other example graphs remain finite and unclipped beyond their first transient', async () => {
  for (const id of Object.keys(graphBuilders).filter(id => !['jazz', 'drone'].includes(id))) {
    const ctx = new OfflineAudioContext(2, sr * 3.1, sr)
    await buildGraph(id, ctx, { duration: 3, seed: 17, when: 0, AudioWorkletNodeClass: AudioWorkletNode })
    const buffer = await ctx.startRendering()
    for (let ch = 0; ch < 2; ch++) {
      const samples = buffer.getChannelData(ch)
      ok(samples.every(Number.isFinite), `${id} ch${ch}: finite`)
      ok(peak(samples) <= 1, `${id} ch${ch}: peak ${peak(samples).toFixed(4)}`)
    }
  }
})
