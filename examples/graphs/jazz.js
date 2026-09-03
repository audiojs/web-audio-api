// Jazz: Generate a jazz performance in a chosen style, modal to bossa, with bass, comping, drums, and an improvised lead on guitar, flute, harp, or piano.
// CLI: npx web-audio-api jazz
// Pass any compatible Web Audio context; the browser or CLI wrapper owns I/O and lifecycle.

function seeded(seed) {
  let state = seed >>> 0
  return () => {
    state += 0x6D2B79F5
    let n = state
    n = Math.imul(n ^ n >>> 15, n | 1)
    n ^= n + Math.imul(n ^ n >>> 7, n | 61)
    return ((n ^ n >>> 14) >>> 0) / 4294967296
  }
}

// A style is a bundle: a form (which chords, for how long), a bass feel, a comping pattern,
// a drum pattern, and the improviser's vocabulary, plus a tempo range and how hard the
// eighths swing at a medium tempo. The modal family comes first: slow harmonic rhythm,
// extended chords voice-led from one to the next, a bass that pedals, and space.
export const styles = {
  modal: { bpm: [76, 92], swing: 0.62, form: 'modal', bass: 'modal', comp: 'pad', drums: 'light', phrase: 'modal' },
  ambient: { bpm: [50, 62], swing: 0.5, form: 'ambient', bass: 'pedal', comp: 'pad', drums: 'swell', phrase: 'ambient' },
  nordic: { bpm: [62, 78], swing: 0.56, form: 'nordic', bass: 'two', comp: 'sustain', drums: 'brushes', phrase: 'lyrical' },
  ballad: { bpm: [56, 68], swing: 0.58, form: 'ballad', bass: 'two', comp: 'sustain', drums: 'brushes', phrase: 'ballad' },
  bossa: { bpm: [118, 136], swing: 0.5, form: 'bossa', bass: 'bossa', comp: 'bossa', drums: 'bossa', phrase: 'bossa' },
  swing: { bpm: [138, 176], swing: 0.66, form: 'aaba', bass: 'walk', comp: 'stabs', drums: 'swing', phrase: 'bebop' },
  blues: { bpm: [100, 126], swing: 0.66, form: 'blues', bass: 'walk', comp: 'stabs', drums: 'shuffle', phrase: 'blues' },
}
export const leads = ['guitar', 'flute', 'harp', 'piano']

// chord vocabulary: scale, chord tones, the colour tones a modal line likes to land on, and a
// rootless voicing, all as semitones above the root
const qualities = {
  maj7: { scale: [0, 2, 4, 5, 7, 9, 11], tones: [0, 4, 7, 11], colors: [4, 11, 14], voicing: [4, 7, 11, 14] },
  'maj7#11': { scale: [0, 2, 4, 6, 7, 9, 11], tones: [0, 4, 7, 11], colors: [6, 11, 14, 4], voicing: [4, 11, 14, 18] },
  m7: { scale: [0, 2, 3, 5, 7, 9, 10], tones: [0, 3, 7, 10], colors: [3, 10, 14], voicing: [3, 7, 10, 14] },
  m11: { scale: [0, 2, 3, 5, 7, 9, 10], tones: [0, 3, 7, 10], colors: [5, 14, 3, 10], voicing: [3, 10, 14, 17] },
  sus: { scale: [0, 2, 4, 5, 7, 9, 10], tones: [0, 5, 7, 10], colors: [5, 14, 10], voicing: [5, 10, 14, 19] },
  7: { scale: [0, 2, 4, 5, 7, 9, 10], tones: [0, 4, 7, 10], colors: [4, 10, 14], voicing: [4, 10, 14, 19] },
  m7b5: { scale: [0, 1, 3, 5, 6, 8, 10], tones: [0, 3, 6, 10], colors: [3, 6, 10], voicing: [3, 6, 10, 13] },
  dim7: { scale: [0, 2, 3, 5, 6, 8, 9, 11], tones: [0, 3, 6, 9], colors: [3, 6, 9], voicing: [3, 6, 9, 14] },
}
const quartal = [[0, 5, 10, 15, 19], [0, 5, 10, 14, 19], [0, 3, 10, 14, 17], [0, 5, 7, 10, 14], [0, 7, 10, 14, 19]]
const styleNames = Object.keys(styles)

export async function init(ctx, {
  style = 'modal', lead = 'guitar', bpm = null, duration = 270, seed = null,
  when = ctx.currentTime, destination = ctx.destination, AudioWorkletNodeClass = null,
} = {}) {
  if (!AudioWorkletNodeClass) throw new TypeError('AudioWorkletNode is not available')
  let random = seed == null ? Math.random : seeded(seed)
  let pick = list => list[random() * list.length | 0]
  let chance = p => random() < p
  let plan = styles[style] || styles.modal
  if (!leads.includes(lead)) lead = 'guitar'
  if (!styleNames.includes(style)) style = 'modal'
  bpm = Number(bpm) || Math.round((plan.bpm[0] + plan.bpm[1]) / 2)
  let beat = 60 / bpm
  let swing = Math.max(0.5, plan.swing - Math.max(0, bpm - 120) / 600) // eighths straighten as the tempo climbs
  let totalBeats = Math.max(4, Math.ceil(duration / beat))
  let t0 = when
  let midi = note => 440 * 2 ** ((note - 69) / 12)
  // absolute beat position to time: the second half of a beat swings
  let at = position => {
    let whole = Math.floor(position), part = position - whole
    let offset = part === 0.5 ? swing : part < 0.5 ? part * 2 * swing : swing + (part - 0.5) * 2 * (1 - swing)
    return t0 + (whole + offset) * beat
  }
  let energy = position => { let p = position / totalBeats; return (p < 0.7 ? p / 0.7 : (1 - p) / 0.3) ** 0.7 }

  // --- Harmony: one chorus of the form in a random key, repeated for the duration ---
  let key = 53 + pick([0, 5, 10, 3, 7, 2]) // F, Bb, Eb, Ab, C, G, as a bass root
  let chord = (degree, quality, beats) => ({ root: key + degree, quality, beats })
  let forms = {
    aaba: () => {
      let a = [[0, 'maj7', 4], [9, 'm7', 4], [2, 'm7', 4], [7, 7, 4], [4, 'm7', 4], [9, 7, 4], [2, 'm7', 4], [7, 7, 4]]
      let b = [[4, 7, 8], [9, 7, 8], [2, 7, 8], [7, 7, 8]]
      let last = [[0, 'maj7', 4], [9, 'm7', 4], [2, 'm7', 4], [7, 7, 4], [0, 'maj7', 8], [2, 'm7', 4], [7, 7, 4]]
      return [...a, ...a, ...b, ...last]
    },
    blues: () => [[0, 7, 4], [5, 7, 4], [0, 7, 4], [0, 7, 4], [5, 7, 4], [6, 'dim7', 4], [0, 7, 4], [9, 7, 4], [2, 'm7', 4], [7, 7, 4], [0, 7, 2], [9, 7, 2], [2, 'm7', 2], [7, 7, 2]],
    ballad: () => [[0, 'maj7', 8], [5, 'm7', 4], [10, 7, 4], [0, 'maj7', 8], [4, 'm7', 4], [9, 7, 4], [2, 'm7', 8], [7, 7, 8], [0, 'maj7', 8], [2, 'm7', 4], [7, 7, 4]],
    bossa: () => [[0, 'maj7', 8], [2, 7, 8], [2, 'm7', 8], [1, 7, 8], [0, 'maj7', 8], [2, 7, 8], [2, 'm7', 4], [7, 7, 4], [0, 'maj7', 8]],
    // modal: slow changes moving by whole step, minor third, or fourth, never a bare half step,
    // between dorian m11 chords with the odd sus and one lydian colour
    modal: () => {
      let moves = [2, -2, 3, -3, 5, -5, 5, 7, -7], root = 0, out = []
      for (let i = 0; i < 8; i++) {
        let quality = pick(['m11', 'm11', 'm11', 'm7', 'sus', 'maj7#11'])
        out.push([((root % 12) + 12) % 12, quality, pick([16, 16, 8])])
        root += pick(moves)
      }
      return out
    },
    // ambient: two or three lydian and m11 colours a fourth or a whole step apart, held long
    ambient: () => {
      let a = pick([0, 5, 10]), b = pick([2, 7, 9])
      return [[a, 'maj7#11', 32], [b, 'm11', 16], [a, 'maj7#11', 16], [pick([5, 7, 10]), 'sus', 16]]
    },
    // nordic: an aeolian cycle with lydian and sus colour, eight beats each
    nordic: () => [[0, 'm11', 8], [10, 'maj7#11', 8], [8, 'maj7#11', 8], [7, 'sus', 8], [0, 'm11', 8], [3, 'maj7#11', 8], [5, 'm11', 8], [7, 'sus', 8]],
  }
  let chorus = forms[plan.form]().map(([degree, quality, beats]) => chord(degree, quality, beats))
  let chords = [], position = 0
  while (position < totalBeats) for (let c of chorus) { if (position >= totalBeats) break; chords.push({ ...c, start: position }); position += c.beats }
  let chordAt = position => chords.find(c => position >= c.start && position < c.start + c.beats) || chords[chords.length - 1]
  let chordAfter = c => chords[chords.indexOf(c) + 1] || c
  let chordNames = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
  let chordLog = chorus.map(c => chordNames[c.root % 12] + (c.quality === 7 ? '7' : c.quality))
  let toneNear = (c, near, offsets) => { // the chord's offset closest to `near`
    let best = null
    for (let octave = -3; octave <= 4; octave++) for (let offset of offsets) {
      let note = c.root + 12 * octave + offset
      if (best == null || Math.abs(note - near) < Math.abs(best - near)) best = note
    }
    return best
  }

  // --- Bass line: a list of { position, beats, note, velocity } ---
  let bassNotes = []
  let bassRange = [28, 40] // E1 to E2: the low end of the double bass
  let clampBass = note => { while (note < bassRange[0]) note += 12; while (note > bassRange[1]) note -= 12; return note }
  let approach = (from, target) => { // a note one beat before `target`, leading into it
    let kind = random()
    if (kind < 0.35) return target - 1
    if (kind < 0.6) return target + 1
    if (kind < 0.8) return target + 7 > bassRange[1] ? target - 5 : target + 7
    return from + (target > from ? 2 : -2)
  }
  let bassLines = {
    walk: () => {
      let last = clampBass(chords[0].root)
      for (let c of chords) {
        let next = clampBass(chordAfter(c).root), tones = qualities[c.quality]
        for (let b = 0; b < c.beats; b++) {
          let position = c.start + b, inBar = b % 4, note
          if (b === c.beats - 1) note = approach(last, next)
          else if (inBar === 0) note = chance(0.8) || b === 0 ? clampBass(c.root) : toneNear(c, last, [4, 3, 7])
          else if (inBar === 2) note = toneNear(c, last + (chance(0.5) ? 3 : -3), tones.tones.slice(1))
          else note = toneNear(c, last + (chance(0.6) ? 2 : -2), tones.scale)
          note = clampBass(note)
          if (note === last) note = clampBass(toneNear(c, last + (chance(0.5) ? 2 : -2), tones.scale))
          bassNotes.push({ position, beats: 1, note, velocity: inBar === 0 ? 0.9 : 0.72 + random() * 0.15 })
          last = note
        }
      }
    },
    two: () => {
      for (let c of chords) {
        let next = clampBass(chordAfter(c).root), root = clampBass(c.root)
        for (let b = 0; b < c.beats; b += 2) {
          let position = c.start + b, lastHalf = b >= c.beats - 2
          if (lastHalf && chance(0.6)) {
            bassNotes.push({ position, beats: 1, note: toneNear(c, root, [7, 4, 3]), velocity: 0.7 })
            bassNotes.push({ position: position + 1, beats: 1, note: approach(root, next), velocity: 0.65 })
          } else bassNotes.push({ position, beats: 2, note: b % 4 === 0 ? root : clampBass(toneNear(c, root + 5, [7, 3, 4])), velocity: b % 4 === 0 ? 0.85 : 0.7 })
        }
      }
    },
    bossa: () => {
      for (let c of chords) {
        let root = clampBass(c.root), fifth = clampBass(root + 7 > bassRange[1] ? root - 5 : root + 7)
        for (let b = 0; b < c.beats; b += 2) {
          let position = c.start + b, note = b % 4 === 0 ? root : fifth
          bassNotes.push({ position, beats: 1.5, note, velocity: 0.85 })
          bassNotes.push({ position: position + 1.5, beats: 0.5, note: b % 4 === 0 ? fifth : root, velocity: 0.6 })
        }
      }
    },
    modal: () => {
      let scalePosition = 0, last = clampBass(chords[0].root)
      for (let c of chords) {
        let next = clampBass(chordAfter(c).root), scale = qualities[c.quality].scale
        for (let b = 0; b < c.beats;) {
          let length = pick([1, 1, 1, 1.5, 2, 0.5])
          if (b + length > c.beats) length = c.beats - b
          if (b > 0.5 && chance(0.12)) { b += length; continue }
          let note
          if (b === 0) { note = clampBass(c.root); scalePosition = 0 }
          else if (b >= c.beats - 1.5) note = approach(last, next)
          else { scalePosition = Math.max(0, Math.min(scale.length * 2 - 1, scalePosition + pick([-1, 1, 1, 0]))); note = clampBass(c.root + 12 * Math.floor(scalePosition / scale.length) + scale[scalePosition % scale.length]) }
          bassNotes.push({ position: c.start + b, beats: length, note: clampBass(note), velocity: b === 0 ? 0.9 : 0.75 })
          last = note; b += length
        }
      }
    },
  }
  bassLines.pedal = () => {
    // the root held in whole and half notes, the fifth or octave for colour, a short walk into the change
    for (let c of chords) {
      let next = clampBass(chordAfter(c).root), root = clampBass(c.root), last = root
      for (let b = 0; b < c.beats;) {
        let remaining = c.beats - b
        if (remaining <= 2 && chordAfter(c).root !== c.root) {
          bassNotes.push({ position: c.start + b, beats: 1, note: toneNear(c, root, [7, 3, 5]), velocity: 0.6 })
          bassNotes.push({ position: c.start + b + 1, beats: 1, note: approach(last, next), velocity: 0.6 })
          break
        }
        let length = remaining >= 4 && chance(0.7) ? 4 : 2
        let note = b === 0 || chance(0.7) ? root : pick([root + 7 <= bassRange[1] ? root + 7 : root - 5, root + 12 <= bassRange[1] ? root + 12 : root])
        bassNotes.push({ position: c.start + b, beats: length, note, velocity: b === 0 ? 0.85 : 0.65 })
        last = note; b += length
      }
    }
  }
  // modal: the root is home, in whole and half notes, but no note is struck twice in a row:
  // the fifth, the octave, or the seventh answers it. The last bar walks into the change.
  bassLines.modal = () => {
    let last = null
    for (let c of chords) {
      let next = clampBass(chordAfter(c).root), root = clampBass(c.root)
      let answers = [7, 12, 10, 5].map(interval => clampBass(root + interval)).filter(note => note !== root)
      for (let b = 0; b < c.beats;) {
        let remaining = c.beats - b
        if (remaining <= 4 && remaining > 2 && chordAfter(c).root !== c.root) {
          let hold = last === root ? answers[0] : root
          let step = pick([root, ...answers].filter(note => note !== hold))
          let lead = clampBass(approach(step, next))
          if (lead === step) lead = clampBass(next - 1)
          bassNotes.push({ position: c.start + b, beats: remaining - 2, note: hold, velocity: 0.7 })
          bassNotes.push({ position: c.start + c.beats - 2, beats: 1, note: step, velocity: 0.6 })
          bassNotes.push({ position: c.start + c.beats - 1, beats: 1, note: lead, velocity: 0.6 })
          last = lead
          break
        }
        let length = remaining >= 4 && chance(0.6) ? 4 : Math.min(2, remaining)
        let note = last !== root && (b === 0 || chance(0.6)) ? root : pick(answers)
        if (note === last) note = note === root ? answers[0] : root
        bassNotes.push({ position: c.start + b, beats: length, note, velocity: b === 0 ? 0.85 : 0.65 })
        last = note; b += length
      }
    }
  }
  bassLines[plan.bass]()

  // --- Comping: chord hits as { position, beats, chord, velocity, notes } ---
  let compHits = []
  // voice leading: of the placements of a chord's voicing, take the one whose notes move least
  // from the previous chord's notes, so changes glide instead of jumping
  let previousVoicing = null
  let voicingOf = c => {
    let offsets = plan.comp === 'pad' && c.quality === 'm7' ? pick(quartal) : qualities[c.quality].voicing
    let candidates = []
    for (let octave = 36; octave <= 72; octave += 12) {
      let notes = offsets.map(offset => c.root % 12 + octave + offset)
      if (notes[0] < 50 || notes[notes.length - 1] > 82) continue
      candidates.push(notes)
      if (previousVoicing) candidates.push(notes.map(note => { // each note may drop an octave toward the previous chord
        let nearest = previousVoicing.reduce((best, p) => Math.abs(p - note) < Math.abs(best - note) ? p : best, previousVoicing[0])
        return note - 12 >= 50 && Math.abs(note - 12 - nearest) < Math.abs(note - nearest) ? note - 12 : note
      }).sort((a, b) => a - b).filter((note, i, all) => note !== all[i - 1]))
    }
    if (!candidates.length) candidates.push(offsets.map(offset => c.root % 12 + 48 + offset))
    let cost = notes => previousVoicing
      ? notes.reduce((sum, note) => sum + Math.min(...previousVoicing.map(p => Math.abs(p - note))), 0)
      : Math.abs(notes[0] - 60)
    previousVoicing = candidates.reduce((best, notes) => cost(notes) < cost(best) ? notes : best, candidates[0])
    return previousVoicing
  }
  let compPatterns = {
    pad: () => { for (let c of chords) compHits.push({ position: c.start, beats: c.beats, chord: c, velocity: 0.8, notes: voicingOf(c) }) },
    sustain: () => {
      for (let c of chords) {
        compHits.push({ position: c.start, beats: Math.min(c.beats, 4), chord: c, velocity: 0.7, notes: voicingOf(c), rolled: true })
        if (c.beats > 4) compHits.push({ position: c.start + 4, beats: c.beats - 4, chord: c, velocity: 0.55, notes: voicingOf(c).map(n => n + (chance(0.5) ? 0 : -12)), rolled: true })
      }
    },
    stabs: () => {
      let bars = [[0, 1.5], [1.5], [0, 1.5, 3.5], [0.5, 2.5], [1.5, 3], [0]]
      for (let bar = 0; bar * 4 < totalBeats; bar++) {
        let e = energy(bar * 4), hits = pick(bars)
        if (e < 0.08) continue
        for (let offset of hits) {
          let position = bar * 4 + offset
          if (position >= totalBeats) continue
          let c = offset === 3.5 ? chordAt(position + 0.5) : chordAt(position) // the "and of four" anticipates the next chord
          compHits.push({ position, beats: pick([0.5, 0.75, 1, 1.5]), chord: c, velocity: 0.45 + e * 0.45, notes: voicingOf(c) })
        }
      }
    },
    bossa: () => {
      let pattern = [[0, 1.5, 3], [0.5, 2, 3.5]]
      for (let bar = 0; bar * 4 < totalBeats; bar++) for (let offset of pattern[bar % 2]) {
        let position = bar * 4 + offset
        if (position >= totalBeats) continue
        let c = chordAt(offset === 3.5 ? position + 0.5 : position)
        compHits.push({ position, beats: 0.5, chord: c, velocity: 0.6 + energy(position) * 0.25, notes: voicingOf(c) })
      }
    },
  }
  compPatterns[plan.comp]()

  // --- Drums: hits as { position, voice, velocity } ---
  let drumHits = []
  let hit = (position, voice, velocity) => { if (position < totalBeats) drumHits.push({ position, voice, velocity }) }
  let bars = Math.ceil(totalBeats / 4)
  let drumPatterns = {
    swing: () => {
      for (let bar = 0; bar < bars; bar++) {
        let start = bar * 4, e = energy(start), phraseEnd = bar % 4 === 3
        for (let b of [0, 1, 1.5, 2, 3, 3.5]) hit(start + b, 'ride', (b % 1 ? 0.5 : b % 2 ? 0.9 : 0.7) * (0.5 + e * 0.5))
        hit(start + 1, 'hat', 0.7); hit(start + 3, 'hat', 0.7)
        for (let b = 0; b < 4; b++) if (chance(0.25 * e)) hit(start + b + pick([0.5, 0.33, 0.66]), 'ghost', 0.4 + e * 0.4)
        if (e > 0.2) { hit(start, 'kick', 0.35); if (chance(e * 0.5)) hit(start + 2, 'kick', 0.3) }
        if (phraseEnd && chance(0.3 + e * 0.5)) { hit(start + 3.5, 'snare', 0.7); if (chance(0.5)) hit(start + 3, 'snare', 0.5) }
      }
    },
    shuffle: () => {
      for (let bar = 0; bar < bars; bar++) {
        let start = bar * 4, e = energy(start)
        for (let b = 0; b < 4; b++) { hit(start + b, 'ride', 0.85); hit(start + b + 0.5, 'ride', 0.5) }
        hit(start + 1, 'snare', 0.75 + e * 0.2); hit(start + 3, 'snare', 0.8 + e * 0.2)
        hit(start, 'kick', 0.8); hit(start + 2, 'kick', 0.7); if (chance(0.3)) hit(start + 3.5, 'kick', 0.5)
        if (bar % 4 === 3 && chance(0.5)) hit(start + 3.5, 'snare', 0.5)
      }
    },
    brushes: () => {
      for (let bar = 0; bar < bars; bar++) {
        let start = bar * 4
        hit(start + 1, 'hat', 0.35); hit(start + 3, 'hat', 0.35)
        if (bar % 2 === 1 && chance(0.4)) hit(start + 3, 'rim', 0.5)
        if (chance(0.3)) hit(start, 'kick', 0.25)
      }
    },
    light: () => {
      for (let bar = 0; bar < bars; bar++) {
        let start = bar * 4, e = energy(start)
        for (let b of [0, 1.5, 2, 3.5]) hit(start + b, 'ride', (b % 1 ? 0.45 : 0.65) * (0.4 + e * 0.6))
        hit(start + 1, 'hat', 0.4); hit(start + 3, 'hat', 0.4)
        if (chance(0.15 * e)) hit(start + pick([1.5, 2.5, 3.5]), 'ghost', 0.4)
        if (bar % 4 === 3 && chance(0.3)) hit(start + 3, 'rim', 0.5)
        if (bar % 8 === 0 && e > 0.3) hit(start, 'kick', 0.3)
      }
    },
    swell: () => {
      for (let bar = 0; bar < bars; bar++) {
        let start = bar * 4
        if (bar % 4 === 0 && chance(0.4)) hit(start, 'kick', 0.2)
        if (bar % 8 === 7 && chance(0.5)) hit(start + 3, 'rim', 0.3)
      }
    },
    bossa: () => {
      let clave = [[0, 1.5, 3], [0.5, 2]]
      for (let bar = 0; bar < bars; bar++) {
        let start = bar * 4
        for (let b = 0; b < 4; b += 0.5) hit(start + b, 'hat', b % 1 ? 0.35 : 0.55)
        for (let b of clave[bar % 2]) hit(start + b, 'rim', 0.8)
        for (let b of [0, 1.5, 2, 3.5]) hit(start + b, 'kick', b % 1 ? 0.45 : 0.7)
      }
    },
  }
  drumPatterns[plan.drums]()

  // --- Improvised lead: phrases built backwards from a target chord tone on a strong beat ---
  let leadNotes = []
  let leadRange = { guitar: [52, 84], flute: [62, 93], harp: [50, 91], piano: [48, 89] }[lead]
  let centre = position => ({ guitar: 66, flute: 77, harp: 72, piano: 68 })[lead] + energy(position) * 7
  let scaleNote = (c, note, steps) => { // move `steps` scale degrees from `note` in chord c's scale
    let scale = qualities[c.quality].scale
    let degrees = []
    for (let octave = -2; octave <= 5; octave++) for (let s of scale) degrees.push(c.root + 12 * octave + s)
    let index = degrees.reduce((best, n, i) => Math.abs(n - note) < Math.abs(degrees[best] - note) ? i : best, 0)
    return degrees[Math.max(0, Math.min(degrees.length - 1, index + steps))]
  }
  let blue = [0, 3, 5, 6, 7, 10]
  // approach devices: notes before the target, as builders returning pitches ending on the target
  let devices = {
    enclosure: (c, T) => pick([[T + 1, T - 1, T], [T - 1, T + 1, T], [scaleNote(c, T, 1), T + 1, T - 1, T], [T + 2, T + 1, T - 1, T]]),
    run: (c, T) => { let n = pick([3, 4, 5]), dir = chance(0.5) ? 1 : -1; return Array.from({ length: n + 1 }, (_, i) => scaleNote(c, T, dir * (n - i))) },
    arpeggio: (c, T) => { let tones = qualities[c.quality].tones, out = [T]; let note = T; for (let i = 0; i < pick([2, 3]); i++) { note = toneNear(c, note - 3, tones) < note ? toneNear(c, note - 3, tones) : note - 4; out.unshift(note) } return out },
    bebop: (c, T) => { let above = scaleNote(c, T, 3); return [above, scaleNote(c, T, 2), scaleNote(c, T, 1), T + 1, T].filter((n, i, a) => i === 0 || n !== a[i - 1]) },
    pentatonic: (c, T) => { // the root's minor pentatonic, walked toward the target
      let set = [0, 3, 5, 7, 10].flatMap(s => [c.root + s, c.root + 12 + s, c.root + 24 + s, c.root + 36 + s])
      let dir = chance(0.6) ? -1 : 1, near = set.filter(n => dir < 0 ? n < T : n > T).sort((a, b) => dir < 0 ? b - a : a - b).slice(0, pick([2, 3, 4]))
      return [...near.reverse(), T]
    },
    quartal: (c, T) => [scaleNote(c, T, -6), scaleNote(c, T, -3), T],
    long: (c, T) => [T],
    blues: (c, T) => { let near = blue.map(s => key + 24 + s).flatMap(n => [n, n + 12, n + 24]); let below = near.filter(n => n < T).sort((a, b) => b - a).slice(0, pick([2, 3])).reverse(); return [...below, T] },
    step: (c, T) => [scaleNote(c, T, chance(0.5) ? -1 : 1), T],
    scoop: (c, T) => [scaleNote(c, T, -1), T],
  }
  let vocabulary = {
    bebop: ['enclosure', 'run', 'arpeggio', 'bebop', 'bebop', 'step'],
    blues: ['blues', 'blues', 'enclosure', 'run', 'step'],
    modal: ['pentatonic', 'pentatonic', 'quartal', 'run', 'step', 'long'],
    ambient: ['long', 'long', 'step', 'scoop', 'quartal'],
    lyrical: ['step', 'run', 'scoop', 'arpeggio', 'long', 'step'],
    ballad: ['scoop', 'step', 'arpeggio', 'run'],
    bossa: ['step', 'run', 'enclosure', 'arpeggio'],
  }[plan.phrase]
  let slow = ['ballad', 'ambient', 'lyrical'].includes(plan.phrase)
  let colourful = ['modal', 'ambient', 'lyrical'].includes(plan.phrase) // land on 9ths, 11ths, and #11s
  let eighth = slow ? 1 : 0.5 // the unit of an approach line
  let cursor = pick([2, 4, 6]), lastTarget = null, motif = null
  while (cursor < totalBeats - 2) {
    let e = energy(cursor)
    let rest = pick(e > 0.6 ? [0, 0.5, 1, 1.5] : e > 0.3 ? [1, 1.5, 2, 3] : [2, 3, 4, 6])
    if (slow) rest += plan.phrase === 'ambient' ? 4 : 2
    if (plan.phrase === 'modal') rest += 1
    let reuse = motif && chance(0.3)
    let approachLength = reuse ? motif.length - 1 : pick([2, 3, 4, 5])
    let target = Math.ceil((cursor + rest + approachLength * eighth) / 2) * 2 // a strong beat: one or three
    if (chance(0.3) && !slow) target -= 0.5 // anticipated by an eighth
    if (target >= totalBeats - 1) break
    let c = chordAt(target)
    let tones = qualities[c.quality].tones
    let preferred = colourful && chance(0.6) ? qualities[c.quality].colors : chance(0.65) ? [tones[1], tones[3]] : tones
    let T = toneNear(c, centre(target) + (random() - 0.5) * 8, preferred)
    if (T === lastTarget) T = toneNear(c, T + (chance(0.5) ? 5 : -5), tones)
    T = Math.max(leadRange[0], Math.min(leadRange[1], T))
    let pitches = reuse ? motif.map(interval => T + interval) : devices[pick(vocabulary)](c, T)
    pitches = pitches.map(n => Math.max(leadRange[0], Math.min(leadRange[1], n)))
    let count = pitches.length
    let start = target - (count - 1) * eighth
    let targetLength = pick(slow ? (plan.phrase === 'ambient' ? [4, 6, 8] : [2, 3, 4]) : plan.phrase === 'modal' ? [1.5, 2, 3, 1] : [1, 1.5, 2, 0.5])
    for (let i = 0; i < count; i++) {
      let last = i === count - 1
      let position = start + i * eighth
      let beats = last ? targetLength : eighth
      leadNotes.push({ position, beats: beats * (lead === 'flute' ? 0.95 : 0.85), note: pitches[i], velocity: (0.5 + 0.45 * i / Math.max(1, count - 1)) * (0.6 + 0.4 * e), scoop: slow || (last && chance(0.3)) })
    }
    let tail = chance(0.4 + e * 0.3) ? pick([1, 2]) : 0 // a turn after the target
    let note = T, position = target + targetLength
    for (let i = 0; i < tail; i++) {
      note = scaleNote(c, note, pick([-1, 1, -2]))
      leadNotes.push({ position, beats: eighth * 0.85, note, velocity: 0.5 * (0.6 + 0.4 * e), scoop: false })
      position += eighth
    }
    motif = pitches.map(n => n - T)
    lastTarget = T
    cursor = position + (tail ? eighth : 0)
  }

  // ---------- Instruments ----------
  let sources = [], nodes = []
  let place = (position, target) => {
    let panner = ctx.createStereoPanner()
    panner.pan.value = position
    panner.connect(destination); panner.connect(target)
    nodes.push(panner)
    return panner
  }
  // a small club: dry plus a darkening tail
  let room = ctx.createConvolver(), roomIn = ctx.createGain(), roomOut = ctx.createGain()
  {
    let length = Math.ceil(ctx.sampleRate * 1.1), ir = ctx.createBuffer(2, length, ctx.sampleRate)
    for (let channel = 0; channel < 2; channel++) {
      let data = ir.getChannelData(channel), smooth = 0
      for (let i = 0; i < length; i++) {
        let t = i / length
        smooth += (1 - 0.93 * Math.sqrt(t)) * ((random() * 2 - 1) - smooth)
        data[i] = smooth * Math.exp(-6.9 * t) * (1 - Math.exp(-i / 30))
      }
    }
    room.buffer = ir
  }
  roomOut.gain.value = { brushes: 0.3, swell: 0.42, light: 0.26 }[plan.drums] ?? 0.2
  roomIn.connect(room).connect(roomOut).connect(destination)
  nodes.push(room, roomIn, roomOut)
  let noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 2), ctx.sampleRate)
  { let data = noiseBuffer.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = random() * 2 - 1 }
  let envelope = (time, peak, attack, hold, release, target) => {
    let gain = ctx.createGain()
    gain.gain.setValueAtTime(0, time)
    gain.gain.linearRampToValueAtTime(peak, time + attack)
    gain.gain.setValueAtTime(peak, time + attack + hold)
    gain.gain.exponentialRampToValueAtTime(0.0005, time + attack + hold + release)
    gain.connect(target); nodes.push(gain)
    return gain
  }

  // Bass: a triangle with a plucked thump and a little finger noise, under a low-pass
  let bassLp = ctx.createBiquadFilter()
  bassLp.type = 'lowpass'; bassLp.frequency.value = 380
  let bassOut = ctx.createGain(); bassOut.gain.value = 0.32
  bassLp.connect(bassOut).connect(place(-0.1, roomIn))
  nodes.push(bassLp, bassOut)
  let playBass = ({ position, beats, note, velocity }) => {
    let time = at(position) + 0.006, length = beats * beat * (plan.bass === 'two' ? 0.95 : 0.85)
    let osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = midi(note)
    let amp = envelope(time, velocity, 0.012, length * 0.5, length * 0.5, bassLp)
    osc.connect(amp)
    osc.start(time); osc.stop(time + length + 0.02)
    osc.onended = () => amp.disconnect()
    let thump = ctx.createOscillator(); thump.frequency.setValueAtTime(midi(note) * 2, time); thump.frequency.exponentialRampToValueAtTime(midi(note), time + 0.03)
    let thumpAmp = envelope(time, velocity * 0.5, 0.002, 0, 0.05, bassLp)
    thump.connect(thumpAmp); thump.start(time); thump.stop(time + 0.06)
    thump.onended = () => thumpAmp.disconnect()
    sources.push(osc, thump); nodes.push(osc, thump)
  }

  // Comping: a sustained sawtooth pad for the modal style, an electric-piano tone otherwise
  let compFilter = ctx.createBiquadFilter()
  compFilter.type = 'lowpass'; compFilter.Q.value = 0.5; compFilter.frequency.value = plan.comp === 'pad' ? 900 : 5000
  let compOut = ctx.createGain(); compOut.gain.value = plan.comp === 'pad' ? 0.06 : 0.11
  compFilter.connect(compOut).connect(place(0.15, roomIn))
  nodes.push(compFilter, compOut)
  let playComp = ({ position, beats, velocity, notes, rolled }) => {
    let time = at(position), length = beats * beat
    if (plan.comp === 'pad') compFilter.frequency.setValueAtTime(700 + energy(position) * 500, time)
    notes.forEach((note, i) => {
      let start = time + (rolled ? i * 0.025 : 0)
      if (plan.comp === 'pad') {
        let osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = midi(note); osc.detune.value = [-5, 3, -2, 4, -3][i % 5]
        let amp = envelope(start, velocity, beat, Math.max(0, length - beat * 2), beat, compFilter)
        osc.connect(amp); osc.start(start); osc.stop(start + length + 0.05)
        osc.onended = () => amp.disconnect()
        sources.push(osc); nodes.push(osc)
        return
      }
      let amp = ctx.createGain()
      amp.gain.setValueAtTime(0, start)
      amp.gain.linearRampToValueAtTime(velocity, start + 0.004)
      amp.gain.setTargetAtTime(velocity * 0.3, start + 0.004, 0.35) // tine decays into a softer sustain
      amp.gain.setValueAtTime(amp.gain.value, start + length)
      amp.gain.exponentialRampToValueAtTime(0.0005, start + length + (rolled ? 0.4 : 0.06))
      amp.connect(compFilter); nodes.push(amp)
      let last
      for (let [ratio, amount, decay] of [[1, 0.6, 0], [2, 0.16, 0.5], [7, 0.05, 0.08]]) {
        let osc = last = ctx.createOscillator(), partial = ctx.createGain()
        osc.frequency.value = midi(note) * ratio
        if (decay) { partial.gain.setValueAtTime(amount, start); partial.gain.exponentialRampToValueAtTime(amount * 0.01, start + decay) } else partial.gain.value = amount
        osc.connect(partial).connect(amp)
        osc.start(start); osc.stop(start + length + 0.5)
        sources.push(osc); nodes.push(osc, partial)
      }
      last.onended = () => amp.disconnect()
    })
  }

  // Drums: one noise worklet feeds ride, hat, snare, and brushes through filters gated by gain
  await ctx.audioWorklet.addModule('data:text/javascript,' + encodeURIComponent(`
  class N extends AudioWorkletProcessor {
    process(_, o) { for (let i = 0, d = o[0][0]; i < d.length; i++) d[i] = Math.random() * 2 - 1; return true }
  }; registerProcessor('noise', N)`))
  let noise = new AudioWorkletNodeClass(ctx, 'noise')
  let kitPan = place(-0.3, roomIn)
  let kitVoice = (filters, gainValue = 0) => {
    let head = noise
    for (let [type, frequency, q = 1] of filters) {
      let filter = ctx.createBiquadFilter()
      filter.type = type; filter.frequency.value = frequency; filter.Q.value = q
      head.connect(filter); head = filter; nodes.push(filter)
    }
    let gain = ctx.createGain(); gain.gain.value = gainValue
    head.connect(gain).connect(kitPan)
    nodes.push(gain)
    return gain
  }
  let rideG = kitVoice([['bandpass', 8000, 1.5]])
  let hatG = kitVoice([['highpass', 10000]])
  let snareG = kitVoice([['highpass', 600], ['bandpass', 2200, 0.6]])
  let ghostG = kitVoice([['bandpass', 300, 2]])
  let ping = ctx.createOscillator(); ping.frequency.value = 5150
  let pingG = ctx.createGain(); pingG.gain.value = 0
  ping.connect(pingG).connect(kitPan)
  ping.start(t0); ping.stop(t0 + duration + 1)
  sources.push(ping); nodes.push(ping, pingG)
  if (plan.drums === 'brushes' || plan.drums === 'swell' || plan.drums === 'light') {
    let level = plan.drums === 'light' ? 0.006 : 0.012
    let brushG = kitVoice([['highpass', 5000]], level)
    let swoosh = ctx.createOscillator(); swoosh.type = 'sine'; swoosh.frequency.value = plan.drums === 'swell' ? bpm / 480 : bpm / 120
    let swooshG = ctx.createGain(); swooshG.gain.value = level * 0.85
    swoosh.connect(swooshG).connect(brushG.gain)
    swoosh.start(t0); swoosh.stop(t0 + duration + 1)
    sources.push(swoosh); nodes.push(swoosh, swooshG)
  }
  let gate = (gain, time, level, decay) => { gain.gain.setValueAtTime(level, time); gain.gain.exponentialRampToValueAtTime(0.001, time + decay) }
  let tone = (time, frequency, level, decay, target, drop = 0) => {
    let osc = ctx.createOscillator()
    if (drop) { osc.frequency.setValueAtTime(frequency * drop, time); osc.frequency.exponentialRampToValueAtTime(frequency, time + 0.08) } else osc.frequency.value = frequency
    let amp = envelope(time, level, 0.003, 0, decay, target)
    osc.connect(amp); osc.start(time); osc.stop(time + decay + 0.02)
    osc.onended = () => amp.disconnect()
    sources.push(osc); nodes.push(osc)
  }
  let kickPan = place(0, roomIn)
  let drumVoices = {
    ride: (time, v) => { gate(rideG, time, 0.045 * v, 0.14); gate(pingG, time, 0.014 * v, 0.05) },
    hat: (time, v) => gate(hatG, time, 0.05 * v, 0.06),
    ghost: (time, v) => gate(ghostG, time, 0.035 * v, 0.12),
    snare: (time, v) => { gate(snareG, time, 0.12 * v, 0.16); tone(time, 190, 0.1 * v, 0.1, kitPan) },
    rim: (time, v) => { tone(time, 1250, 0.08 * v, 0.03, kitPan); tone(time, 620, 0.05 * v, 0.02, kitPan) },
    kick: (time, v) => tone(time, 52, 0.09 * v, 0.22, kickPan, 3),
  }

  // Lead: a jazz guitar (an extended Karplus-Strong string rendered per note), a flute, a
  // harp (additive pluck that rings on), or a piano (inharmonic partials with a hammer)
  let leadChain = {
    guitar: { cutoff: 3200, body: [220, 3], level: 0.24 },
    flute: { cutoff: 7000, body: [1800, 2], level: 0.2 },
    harp: { cutoff: 6500, body: [900, 1.5], level: 0.26 },
    piano: { cutoff: 7500, body: [500, 1.5], level: 0.22 },
  }[lead]
  let leadFilter = ctx.createBiquadFilter()
  leadFilter.type = 'lowpass'; leadFilter.frequency.value = leadChain.cutoff; leadFilter.Q.value = 0.7
  let leadBody = ctx.createBiquadFilter()
  leadBody.type = 'peaking'; leadBody.frequency.value = leadChain.body[0]; leadBody.Q.value = 1.2; leadBody.gain.value = leadChain.body[1]
  let leadOut = ctx.createGain(); leadOut.gain.value = leadChain.level
  let leadPan = place(0.35, roomIn)
  if (lead === 'guitar') {
    // a small tube combo: gentle saturation, the neck pickup's mid hump, then the tone control
    let amp = ctx.createWaveShaper(), curve = new Float32Array(2048), drive = 2.2
    for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(drive * (i / (curve.length - 1) * 2 - 1)) / Math.tanh(drive)
    amp.curve = curve
    try { amp.oversample = '2x' } catch { /* optional */ }
    let hump = ctx.createBiquadFilter()
    hump.type = 'peaking'; hump.frequency.value = 1300; hump.Q.value = 1; hump.gain.value = 3
    leadFilter.connect(amp).connect(hump).connect(leadBody).connect(leadOut).connect(leadPan)
    nodes.push(amp, hump)
  } else leadFilter.connect(leadBody).connect(leadOut).connect(leadPan)
  nodes.push(leadFilter, leadBody, leadOut)
  // Extended Karplus-Strong string, rendered per note. The string starts from a plectrum
  // displacement at the pick point plus a little noise (more with a harder pick), runs
  // through a loop whose one-pole damping lets the highs ring longer on hard picks, and
  // decays over a T60 that shortens with pitch. The loop is an integer number of samples;
  // the playback rate corrects the pitch to the cent.
  let pluck = (frequency, seconds, velocity) => {
    let sampleRate = ctx.sampleRate, period = sampleRate / frequency, n = Math.round(period)
    let length = Math.ceil(sampleRate * seconds)
    let buffer = ctx.createBuffer(1, length, sampleRate), data = buffer.getChannelData(0)
    let pickPoint = Math.round(n * (0.14 + random() * 0.08)), noiseLevel = 0.1 + 0.4 * velocity, smooth = 0
    let ring = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      let displacement = i < pickPoint ? i / pickPoint : (n - i) / (n - pickPoint) // a triangle plucked at the pick point
      smooth += (0.3 + 0.5 * velocity) * ((random() * 2 - 1) - smooth)
      ring[i] = displacement * 0.9 + smooth * noiseLevel
    }
    let mean = ring.reduce((sum, value) => sum + value, 0) / n
    for (let i = 0; i < n; i++) ring[i] -= mean // the loop would hold any offset forever
    let t60 = Math.max(1.8, 3.4 - frequency / 600), rho = 10 ** (-3 * n / (t60 * sampleRate))
    let damping = 0.32 - 0.2 * velocity // one-pole blend: lower keeps the highs; reading the next slot shortens the loop by `damping` samples
    let p = 0
    for (let i = 0; i < length; i++) {
      let next = (p + 1) % n
      data[i] = ring[p]
      ring[p] = rho * ((1 - damping) * ring[p] + damping * ring[next])
      p = next
    }
    return { buffer, rate: (n - damping) / period }
  }
  let playLead = ({ position, beats, note, velocity, scoop }) => {
    let time = at(position), length = beats * beat, frequency = midi(note)
    if (lead === 'guitar') {
      let source = ctx.createBufferSource()
      let string = pluck(frequency, length + 0.4, velocity)
      source.buffer = string.buffer; source.playbackRate.value = string.rate
      let amp = ctx.createGain()
      amp.gain.setValueAtTime(0.25 + 0.75 * velocity, time)
      amp.gain.setValueAtTime(0.25 + 0.75 * velocity, time + length)
      amp.gain.exponentialRampToValueAtTime(0.0005, time + length + 0.14) // the player lifts off
      amp.connect(leadFilter); nodes.push(amp)
      source.connect(amp)
      source.start(time); source.stop(time + length + 0.16)
      source.onended = () => amp.disconnect()
      sources.push(source); nodes.push(source)
      return
    }
    if (lead === 'harp' || lead === 'piano') {
      // additive partials, each with its own decay: the highs die first, the string rings on
      // past the written length (a harpist does not damp; a pianist lifts a little later)
      let piano = lead === 'piano'
      let ring = piano ? Math.max(length + 0.4, 1.2) : Math.max(length + 0.8, 2.2)
      let body = ctx.createGain()
      body.gain.setValueAtTime(0, time)
      body.gain.linearRampToValueAtTime(0.3 + 0.7 * velocity, time + 0.002)
      body.gain.setValueAtTime(0.3 + 0.7 * velocity, time + (piano ? length : ring - 0.3))
      body.gain.exponentialRampToValueAtTime(0.0005, time + (piano ? length + 0.25 : ring))
      body.connect(leadFilter); nodes.push(body)
      let stiffness = piano ? 0.0004 : 0.00008, last
      let partials = piano ? [[1, 1], [2, 0.5], [3, 0.3], [4, 0.18], [5, 0.1], [6, 0.06]] : [[1, 1], [2, 0.45], [3, 0.22], [4, 0.1], [5, 0.05]]
      for (let [h, amount] of partials) {
        let osc = last = ctx.createOscillator(), partial = ctx.createGain()
        osc.frequency.value = frequency * h * Math.sqrt(1 + stiffness * h * h)
        if (piano && h === 1) osc.detune.value = 1.5 // a second, slightly sharp string in the unison
        let brightness = amount * (0.5 + 0.5 * velocity) ** (h - 1)
        let decay = ring / (1 + 0.35 * (h - 1))
        partial.gain.setValueAtTime(brightness, time)
        partial.gain.exponentialRampToValueAtTime(brightness * 0.002, time + decay)
        osc.connect(partial).connect(body)
        osc.start(time); osc.stop(time + ring + 0.05)
        sources.push(osc); nodes.push(osc, partial)
      }
      if (piano) { // the unison's second string on the fundamental, and the hammer
        let osc = ctx.createOscillator(), partial = ctx.createGain()
        osc.frequency.value = frequency; osc.detune.value = -1.5
        partial.gain.setValueAtTime(0.9, time); partial.gain.exponentialRampToValueAtTime(0.002, time + ring)
        osc.connect(partial).connect(body); osc.start(time); osc.stop(time + ring + 0.05)
        sources.push(osc); nodes.push(osc, partial)
      }
      last.onended = () => body.disconnect()
      let pluck = ctx.createBufferSource(), pluckColor = ctx.createBiquadFilter(), pluckAmp = ctx.createGain()
      pluck.buffer = noiseBuffer
      pluckColor.type = piano ? 'lowpass' : 'bandpass'; pluckColor.frequency.value = piano ? 1500 : Math.min(8000, frequency * 4); pluckColor.Q.value = piano ? 0.7 : 1.5
      pluckAmp.gain.setValueAtTime(0, time)
      pluckAmp.gain.linearRampToValueAtTime((piano ? 0.12 : 0.08) * velocity, time + 0.001)
      pluckAmp.gain.exponentialRampToValueAtTime(0.0005, time + (piano ? 0.012 : 0.006))
      pluck.connect(pluckColor).connect(pluckAmp).connect(leadFilter)
      pluck.start(time, random() * 1.5); pluck.stop(time + 0.015)
      pluck.onended = () => pluckAmp.disconnect()
      sources.push(pluck); nodes.push(pluck, pluckColor, pluckAmp)
      return
    }
    let attack = Math.min(0.045, length / 3), release = 0.06
    let amp = envelope(time, 0.35 + 0.65 * velocity, attack, Math.max(0, length - attack), release, leadFilter)
    let vibrato = ctx.createOscillator(), vibratoDepth = ctx.createGain()
    vibrato.frequency.value = 5 + random() * 0.6
    vibratoDepth.gain.setValueAtTime(0, time)
    vibratoDepth.gain.linearRampToValueAtTime(length > 0.4 ? 9 : 3, time + Math.min(0.3, length * 0.6))
    vibrato.connect(vibratoDepth)
    let last
    for (let [ratio, amount] of [[1, 0.7], [2, 0.12 + 0.2 * velocity], [3, 0.05]]) {
      let osc = last = ctx.createOscillator(), partial = ctx.createGain()
      osc.frequency.value = frequency * ratio
      if (scoop) { osc.detune.setValueAtTime(-45, time); osc.detune.linearRampToValueAtTime(0, time + Math.min(0.08, length / 2)) }
      vibratoDepth.connect(osc.detune)
      partial.gain.value = amount
      osc.connect(partial).connect(amp)
      osc.start(time); osc.stop(time + length + release + 0.02)
      sources.push(osc); nodes.push(osc, partial)
    }
    vibrato.start(time); vibrato.stop(time + length + release + 0.02)
    sources.push(vibrato); nodes.push(vibrato, vibratoDepth)
    last.onended = () => amp.disconnect()
    // breath: band-passed noise, strongest at the onset
    let breath = ctx.createBufferSource(), band = ctx.createBiquadFilter(), breathAmp = ctx.createGain()
    breath.buffer = noiseBuffer
    band.type = 'bandpass'; band.frequency.value = frequency * 2; band.Q.value = 4
    breathAmp.gain.setValueAtTime(0, time)
    breathAmp.gain.linearRampToValueAtTime(0.09 * velocity, time + attack)
    breathAmp.gain.exponentialRampToValueAtTime(0.03 * velocity, time + attack + 0.15)
    breathAmp.gain.setValueAtTime(0.03 * velocity, time + length)
    breathAmp.gain.exponentialRampToValueAtTime(0.0005, time + length + release)
    breath.connect(band).connect(breathAmp).connect(amp)
    breath.start(time, random() * 1.5); breath.stop(time + length + release + 0.02)
    breath.onended = () => breathAmp.disconnect()
    sources.push(breath); nodes.push(breath, band, breathAmp)
  }

  // ---------- Scheduling: events are data; nodes are built a bar ahead on live contexts ----------
  let events = [
    ...bassNotes.map(n => ({ position: n.position, play: () => playBass(n) })),
    ...compHits.map(n => ({ position: n.position, play: () => playComp(n) })),
    ...drumHits.map(n => ({ position: n.position, play: () => drumVoices[n.voice](at(n.position), n.velocity) })),
    ...leadNotes.map(n => ({ position: n.position, play: () => playLead(n) })),
  ].filter(event => event.position < totalBeats).sort((a, b) => a.position - b.position)
  let scheduled = 0
  let scheduleUntil = horizonBeats => { while (scheduled < events.length && events[scheduled].position < horizonBeats) events[scheduled++].play() }
  if (typeof ctx.startRendering === 'function') scheduleUntil(Infinity)
  else {
    let lookahead = 6 // beats
    scheduleUntil((ctx.currentTime - t0) / beat + lookahead)
    let timer = setInterval(() => {
      if (ctx.state !== 'running' || scheduled >= events.length) return clearInterval(timer)
      scheduleUntil((ctx.currentTime - t0) / beat + lookahead)
    }, 250)
  }

  return {
    sources, nodes, duration: totalBeats * beat,
    graph: 'Style: form, bass, comping, drums → phrase improviser → instrument chains → Destination',
    data: { bpm, style, lead, key: chordNames[key % 12], chordLog, chords, leadNotes, bassNotes },
  }
}
