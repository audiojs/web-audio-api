// Dirac impulse — single-sample click for impulse response testing.
// Run: node examples/impulse.js 5 0.5s
// Run: node examples/impulse.js count=3 interval=1s
// Keys: space pause · f fire impulse · q quit

import { AudioContext } from 'web-audio-api'
import { init } from './graphs/impulse.js'
import { args, sec, keys, clearLine, help } from './utils.js'

help({
  description: 'fire single-sample impulses for response testing',
  usage: ['', '[count] [interval]', 'count=3 interval=1s'],
  options: [
    ['count=<number>', 'number of scheduled impulses (default: 1)'],
    ['interval=<time>', 'gap between impulses with optional s/m/h suffix (default: 0.5s)'],
  ],
  controls: [['Space', 'pause/resume'], ['F', 'fire another impulse'], ['Q / Esc', 'quit']],
})

let { pos, $ } = args()
let nums = pos.filter(t => /^\d/.test(t))
let count = +(nums[0] || $('count', 1))
let interval = sec(nums[1] || $('interval', '0.5'))

let ctx = new AudioContext()
await ctx.resume()

let fire = () => init(ctx, { count: 1, gain: 1 })
init(ctx, { count, interval, gain: 1 })

keys({ f: fire }, () => { clearLine(); ctx.close() }, ctx)
console.log(`${count} impulse(s), ${interval}s interval  space pause · f fire · q quit`)
setTimeout(() => { clearLine(); ctx.close(); process.exit(0) }, ((count - 1) * interval + 0.5) * 1000)
