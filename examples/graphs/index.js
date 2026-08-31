import { build as additive } from './additive.js'
import { build as beating } from './beating.js'
import { build as binauralBeats } from './binaural-beats.js'
import { build as drone } from './drone.js'
import { build as dtmf } from './dtmf.js'
import { build as fft } from './fft.js'
import { build as fmSynthesis } from './fm-synthesis.js'
import { build as gamelan } from './gamelan.js'
import { build as impulse } from './impulse.js'
import { build as jazz } from './jazz.js'
import { build as karplusStrong } from './karplus-strong.js'
import { build as lfo } from './lfo.js'
import { build as linkedParams } from './linked-params.js'
import { build as metronome } from './metronome.js'
import { build as missingFundamental } from './missing-fundamental.js'
import { build as noise } from './noise.js'
import { build as renderToBuffer } from './render-to-buffer.js'
import { build as rissetRhythm } from './risset-rhythm.js'
import { build as sequencer } from './sequencer.js'
import { build as serial } from './serial.js'
import { build as shepard } from './shepard.js'
import { build as spatial } from './spatial.js'
import { build as speaker } from './speaker.js'
import { build as stereoTest } from './stereo-test.js'
import { build as subtractiveSynth } from './subtractive-synth.js'
import { build as sweep } from './sweep.js'
import { build as tone } from './tone.js'

export { build as buildProcessedBuffer } from './process-file.js'
export { schedule as scheduleDtmfDigit } from './dtmf.js'

export const graphBuilders = {
  additive,
  beating,
  'binaural-beats': binauralBeats,
  drone,
  dtmf,
  fft,
  'fm-synthesis': fmSynthesis,
  gamelan,
  impulse,
  jazz,
  'karplus-strong': karplusStrong,
  lfo,
  'linked-params': linkedParams,
  metronome,
  'missing-fundamental': missingFundamental,
  noise,
  'render-to-buffer': renderToBuffer,
  'risset-rhythm': rissetRhythm,
  sequencer,
  serial,
  shepard,
  spatial,
  speaker,
  'stereo-test': stereoTest,
  'subtractive-synth': subtractiveSynth,
  sweep,
  tone,
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
