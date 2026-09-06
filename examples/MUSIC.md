# Musical examples

These are synthesized instrument models, not sampled recordings. Signal tests cover tuning, timing, headroom, repeatability, and composition rules; naturalness still needs a listening review.

## Listen locally

From a repository checkout:

```sh
node examples/jazz.js style=nordic lead=flute -d 30s
node examples/jazz.js style=bossa lead=guitar -d 30s
node examples/jazz.js style=ambient lead=harp -d 30s
node examples/drone.js voice=strings melody=pentatonic freq=D3 -d 30s
node examples/metronome.js 96 X-x-x-x- sound=pendulum -d 20s
```

For device-free WAV auditions:

```sh
node scripts/render-music.mjs
```

This writes `build/music/`: all seven jazz styles, four isolated lead instruments, five drone voices, strings with melody, and nine metronome presets. All use seed 17 at 44.1 kHz stereo. The renderer refuses clipped/non-finite output and does not normalize each file to a different loudness. `results.json` records options, peak, and RMS.

## Jazz

| Style | Harmony and accompaniment | Lead vocabulary |
| --- | --- | --- |
| Modal | Four-bar Aeolian plateaus, major lift and suspended-fifth return; root/fifth voicings with two stronger swells per chord | Pentatonic and fourth-based shapes, held colour tones |
| Ambient | Eight-bar Lydian holds, relative-minor and subdominant colours; sparse percussion | Long tones, short answers, spacious motifs |
| Nordic | Minor-nine cycle with major/suspended contrasts; open bass answers and sparse cymbals | Lyrical scale phrases and ornaments |
| Ballad | Tonic, borrowed minor subdominant, backdoor dominant and ii–V; bass in two, rolled piano voicings | Grace notes, lyrical targets and breathing space |
| Bossa | Major/secondary-dominant/ii–V and tritone-substitute motion; two-bar comping, anticipated bass, Brazilian rim pattern | Straight eighths, syncopation and anticipations |
| Swing | 32-bar AABA with a dominant bridge; quarter-note walking bass and ride pattern | Enclosures, arpeggios, bebop passing notes, triplets |
| Blues | 12-bar jazz blues, diminished passing chord and turnaround; shuffle bass riffs | Blue-note approaches, call/response, bends |

Motifs recur as questions and answers. Non-chromatic notes are adapted to the local harmony; targets land on chord tones or style-appropriate extensions. Anticipated targets follow the approaching chord. Notes are octave-folded into the instrument's range, not clipped to an unrelated boundary pitch.

The guitar uses a damped plucked-string loop, pickup colouring, a short attack, pitch settling, bends and delayed vibrato. Flute harmonics vary by register, with delayed vibrato and sustained broadband breath. Harp strings have a longer, pluck-point-shaped partial spectrum and a second vibration mode. Piano/comping partials decay independently; releases continue from the computed envelope level rather than jumping to a scheduled getter snapshot.

`graph.data` includes chords, bass/lead notes, comping and drum events. `data.stems` exposes bass, comp and lead gain nodes and the two drum routing nodes for inspection or muting. Noise and room synthesis are seeded as well as the composition. Drums reuse the two-second noise buffer; jazz needs no AudioWorklet. `graph.readout(context.currentTime)` returns the currently sounding chord, or an empty string before/after the performance.

## Drone

- **Tanpura:** signed string modes, evolving bridge buzz, a short tension settle, and continuous retuning of ringing and queued strings. The four-cent settle uses control-rate updates; amplitude envelopes and retuning remain audio-rate.
- **Pad:** softened harmonic spectrum, independent pitch drift, gentler resonance and less sub-bass.
- **Shruti / harmonic:** continuously retunable reed and harmonic banks.
- **Strings:** thirteen independently phased players in open fifths/octaves, body-shaped harmonics, separate pitch and bow-pressure motion, and quiet bow friction.

`melody=off` remains the default. `pentatonic` and `dorian` add slow phrases with rests, kept within the performance duration. The melody follows retuning too.

## Metronome

`classic` is the compact mechanical tick. `pendulum` adds alternating wooden-case contacts and a small accent bell. `quartz` is a dry electronic piezo click; `clave` a hollow struck-wood alternative. Existing `wood`, `bell`, `beep`, `signal`, and `karatala` remain available.

Rests and zero-velocity hits produce no sound. Inaudible upper modes are omitted rather than folded onto a shared cutoff frequency. Live schedulers survive pause/resume and release completed note groups instead of retaining an entire session.

## Tests

```sh
npm run test:music
```

`test/music.test.js` checks full-form harmony, target-note membership, bass feel, phrase bounds, isolated-lead pitch after entry, drone retuning and stereo output, metronome onset/accent/rest behavior, scheduler lifecycle, and three-second renders of the other graph examples. Device capture and subjective listening are outside this automated check.
