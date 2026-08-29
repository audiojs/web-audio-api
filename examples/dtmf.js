// DTMF touch-tone — the sound of dialing a phone number.
// Run: node examples/dtmf.js 5551234
// Run: node examples/dtmf.js digits=*67 speed=0.15
// Keys: 0-9 * # A-D dial live · q quit

import { AudioContext } from 'web-audio-api'
import { scheduleDtmfDigit } from './_portable.js'
import { args, sec, keys, clearLine, help } from './_util.js'

help({
  description: 'dial telephone DTMF tones',
  usage: ['', '[digits] [tone-duration]', 'digits=*67 speed=0.15'],
  options: [
    ['digits=<sequence>', 'digits to dial; supports 0–9, *, and # (default: interactive)'],
    ['speed=<time>', 'length of each tone and following gap (default: 0.12s)'],
  ],
  controls: [['0–9, *, #, A–D', 'play a tone'], ['Space', 'pause/resume'], ['Q / Esc', 'quit']],
})

let { pos, $ } = args()
let digits = pos.find(t => /^[\d*#]+$/.test(t)) || $('digits', '')
let speed = sec(pos.find(t => /^\d/.test(t) && !/^[\d*#]+$/.test(t)) || $('speed', '0.12'))

let ctx = new AudioContext()
await ctx.resume()

let play = (digit, when) => scheduleDtmfDigit(ctx, digit, { when, duration: speed, gain: 0.3 })

let t = ctx.currentTime
for (let d of digits) { play(d, t); t += speed * 2 }

let binds = {}
for (let d of '0123456789*#ABCD') binds[d] = () => play(d, ctx.currentTime)
keys(binds, () => { clearLine(); ctx.close() }, ctx)

console.log(`DTMF: ${digits || '(type digits)'}  0-9 * # A-D · space pause · q quit`)

if (digits) setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, digits.length * speed * 2 * 1000 + 200)
