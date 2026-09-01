// Pipe audio to system player via stdout.
// Run: node examples/pipe-stdout.js | aplay -f cd
//   or: node examples/pipe-stdout.js | ffplay -f s16le -ar 44100 -ac 2 -

import { AudioContext } from 'web-audio-api'
import { init } from './graphs/pipe-stdout.js'
import { help } from './utils.js'

help({
  description: 'write raw stereo PCM audio to stdout',
  usage: ['| aplay -f cd', '| ffplay -f s16le -ar 44100 -ac 2 -', '| sox -t raw -r 44100 -e signed -b 16 -c 2 - -d'],
  notes: ['stdout contains only signed 16-bit little-endian, 44.1 kHz stereo PCM; messages would corrupt the stream.'],
})

const duration = 2
const ctx = new AudioContext({ sinkId: process.stdout })
await ctx.resume()

init(ctx, { duration })
setTimeout(() => ctx.close(), duration * 1000)
