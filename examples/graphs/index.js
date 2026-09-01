import { init as additive } from './additive.js'
import { init as beating } from './beating.js'
import { init as binauralBeats } from './binaural-beats.js'
import { init as continuity } from './continuity.js'
import { init as drone } from './drone.js'
import { init as dtmf } from './dtmf.js'
import { init as euclidean } from './euclidean.js'
import { init as fft } from './fft.js'
import { init as fmSynthesis } from './fm-synthesis.js'
import { init as gamelan } from './gamelan.js'
import { init as granular } from './granular.js'
import { init as hugginsPitch } from './huggins-pitch.js'
import { init as impulse } from './impulse.js'
import { init as jazz } from './jazz.js'
import { init as karplusStrong } from './karplus-strong.js'
import { init as lfo } from './lfo.js'
import { init as linkedParams } from './linked-params.js'
import { init as metronome } from './metronome.js'
import { init as missingFundamental } from './missing-fundamental.js'
import { init as noise } from './noise.js'
import { init as octaveIllusion } from './octave-illusion.js'
import { init as renderToBuffer } from './render-to-buffer.js'
import { init as reverb } from './reverb.js'
import { init as rissetRhythm } from './risset-rhythm.js'
import { init as scaleIllusion } from './scale-illusion.js'
import { init as sequencer } from './sequencer.js'
import { init as serial } from './serial.js'
import { init as shepard } from './shepard.js'
import { init as spatial } from './spatial.js'
import { init as speaker } from './speaker.js'
import { init as stereoTest } from './stereo-test.js'
import { init as streaming } from './streaming.js'
import { init as subtractiveSynth } from './subtractive-synth.js'
import { init as sweep } from './sweep.js'
import { init as tone } from './tone.js'
import { init as tritoneParadox } from './tritone-paradox.js'
import { init as wavetable } from './wavetable.js'
import { init as zwickerTone } from './zwicker-tone.js'

export { init as buildProcessedBuffer } from './process-file.js'
export { schedule as scheduleDtmfDigit } from './dtmf.js'

export const graphBuilders = {
  additive,
  beating,
  'binaural-beats': binauralBeats,
  continuity,
  drone,
  dtmf,
  euclidean,
  fft,
  'fm-synthesis': fmSynthesis,
  gamelan,
  granular,
  'huggins-pitch': hugginsPitch,
  impulse,
  jazz,
  'karplus-strong': karplusStrong,
  lfo,
  'linked-params': linkedParams,
  metronome,
  'missing-fundamental': missingFundamental,
  noise,
  'octave-illusion': octaveIllusion,
  'render-to-buffer': renderToBuffer,
  reverb,
  'risset-rhythm': rissetRhythm,
  'scale-illusion': scaleIllusion,
  sequencer,
  serial,
  shepard,
  spatial,
  speaker,
  'stereo-test': stereoTest,
  streaming,
  'subtractive-synth': subtractiveSynth,
  sweep,
  tone,
  'tritone-paradox': tritoneParadox,
  wavetable,
  'zwicker-tone': zwickerTone,
}

export function stopGraph(graph, time = 0) {
  if (!graph) return
  for (let source of graph.sources || []) {
    try { source.stop(time) } catch { continue }
  }
  for (let node of graph.nodes || []) {
    try { node.disconnect() } catch { continue }
  }
}

export function buildGraph(id, ctx, options = {}) {
  let build = graphBuilders[id]
  if (!build) throw new Error(`No browser-safe graph is registered for ${id}`)
  return build(ctx, options)
}
