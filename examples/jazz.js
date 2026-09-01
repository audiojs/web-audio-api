// Generative jazz — randomized modal progressions, pentatonic improvisation.
// Different every time. 4-5 minutes. Run: node examples/jazz.js

import { AudioContext, AudioWorkletNode } from 'web-audio-api'
import { init } from './graphs/jazz.js'
import { keys, clearLine, help } from './utils.js'

help({
  description: 'generate a complete modal jazz performance',
  usage: [''],
  controls: [['Space', 'pause/resume'], ['Q / Esc', 'quit']],
  notes: ['Every 4–5 minute performance uses a new tempo, progression, voicings, and improvisation.'],
})

let ctx = new AudioContext()
await ctx.resume()
let demo = await init(ctx, { AudioWorkletNodeClass: AudioWorkletNode })

keys({}, () => { clearLine(); ctx.close() }, ctx)
console.log(`♪ ${demo.data.bpm} BPM, ${(demo.duration / 60).toFixed(1)} min — space pause · q quit\n` + demo.data.chordLog.join(' → '))
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, demo.duration * 1000 + 500)
