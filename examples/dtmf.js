// DTMF touch-tone — the sound of dialing a phone number.
// Run: node examples/dtmf.js 5551234
// Run: node examples/dtmf.js digits=*67 speed=0.15
// Keys: 0-9 * # A-D dial live · q quit

import { AudioContext } from 'web-audio-api'
import { args, sec, keys, clearLine } from './_util.js'

let { pos, $ } = args()
let digits = pos.find(t => /^[\d*#]+$/.test(t)) || $('digits', '')
let speed = sec(pos.find(t => /^\d/.test(t) && !/^[\d*#]+$/.test(t)) || $('speed', '0.12'))

let lo = { 1:697,2:697,3:697,A:697, 4:770,5:770,6:770,B:770, 7:852,8:852,9:852,C:852, '*':941,0:941,'#':941,D:941 }
let hi = { 1:1209,2:1336,3:1477,A:1633, 4:1209,5:1336,6:1477,B:1633, 7:1209,8:1336,9:1477,C:1633, '*':1209,0:1336,'#':1477,D:1633 }

let ctx = new AudioContext()
await ctx.resume()

let play = (d, t) => {
  if (!lo[d]) return
  for (let f of [lo[d], hi[d]]) {
    let osc = ctx.createOscillator()
    osc.frequency.value = f
    let env = ctx.createGain()
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(0.3, t + 0.005)
    env.gain.setValueAtTime(0.3, t + speed - 0.005)
    env.gain.linearRampToValueAtTime(0, t + speed)
    osc.connect(env).connect(ctx.destination)
    osc.start(t); osc.stop(t + speed + 0.01)
  }
}

let t = ctx.currentTime
for (let d of digits) { play(d, t); t += speed * 2 }

let binds = {}
for (let d of '0123456789*#ABCD') binds[d] = () => play(d, ctx.currentTime)
keys(binds, () => { clearLine(); ctx.close() }, ctx)

console.log(`DTMF: ${digits || '(type digits)'}  0-9 * # A-D · space pause · q quit`)

if (digits) setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, digits.length * speed * 2 * 1000 + 200)
