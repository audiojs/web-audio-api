// Benchmark: measures ops/sec for each node type using OfflineAudioContext
import { OfflineAudioContext } from '../index.js'

const SR = 44100
const DURATION = 1 // seconds
const LENGTH = SR * DURATION

async function bench(name, setup) {
  let ctx = new OfflineAudioContext(1, LENGTH, SR)
  let alt = setup(ctx)
  if (alt instanceof OfflineAudioContext) ctx = alt
  let start = performance.now()
  await ctx.startRendering()
  let ms = performance.now() - start
  let blocksPerSec = (LENGTH / 128) / (ms / 1000)
  let realtime = (ms / 1000) / DURATION
  console.log(`${name.padEnd(28)} ${ms.toFixed(1).padStart(7)}ms  ${blocksPerSec.toFixed(0).padStart(7)} blocks/s  ${realtime < 1 ? '✓ real-time' : `${realtime.toFixed(1)}x slower`}`)
}

console.log('Web Audio API Benchmark — 1s of audio at 44100Hz\n')
console.log('Node'.padEnd(28) + '    Time'.padStart(7) + '  Throughput'.padStart(12) + '  Status')
console.log('─'.repeat(70))

await bench('silence (baseline)', ctx => {})

await bench('OscillatorNode (sine)', ctx => {
  let osc = ctx.createOscillator()
  osc.connect(ctx.destination)
  osc.start(0)
})

await bench('OscillatorNode (square)', ctx => {
  let osc = ctx.createOscillator()
  osc.type = 'square'
  osc.connect(ctx.destination)
  osc.start(0)
})

await bench('GainNode', ctx => {
  let osc = ctx.createOscillator()
  let gain = ctx.createGain()
  gain.gain.value = 0.5
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(0)
})

await bench('BiquadFilterNode (lowpass)', ctx => {
  let osc = ctx.createOscillator()
  let filt = ctx.createBiquadFilter()
  filt.type = 'lowpass'
  filt.frequency.value = 1000
  osc.connect(filt)
  filt.connect(ctx.destination)
  osc.start(0)
})

await bench('StereoPannerNode', () => {
  let ctx = new OfflineAudioContext(2, LENGTH, SR)
  let osc = ctx.createOscillator()
  let pan = ctx.createStereoPanner()
  pan.pan.value = 0.5
  osc.connect(pan)
  pan.connect(ctx.destination)
  osc.start(0)
  return ctx
})

await bench('DelayNode (10ms)', ctx => {
  let osc = ctx.createOscillator()
  let delay = ctx.createDelay()
  delay.delayTime.value = 0.01
  osc.connect(delay)
  delay.connect(ctx.destination)
  osc.start(0)
})

await bench('WaveShaperNode (no oversample)', ctx => {
  let osc = ctx.createOscillator()
  let ws = ctx.createWaveShaper()
  let curve = new Float32Array(256)
  for (let i = 0; i < 256; i++) curve[i] = Math.tanh((i / 128 - 1) * 3)
  ws.curve = curve
  osc.connect(ws)
  ws.connect(ctx.destination)
  osc.start(0)
})

await bench('IIRFilterNode', ctx => {
  let osc = ctx.createOscillator()
  let iir = ctx.createIIRFilter([0.1], [1, -0.9])
  osc.connect(iir)
  iir.connect(ctx.destination)
  osc.start(0)
})

await bench('DynamicsCompressorNode', ctx => {
  let osc = ctx.createOscillator()
  let comp = ctx.createDynamicsCompressor()
  osc.connect(comp)
  comp.connect(ctx.destination)
  osc.start(0)
})

await bench('AnalyserNode', ctx => {
  let osc = ctx.createOscillator()
  let an = ctx.createAnalyser()
  osc.connect(an)
  an.connect(ctx.destination)
  osc.start(0)
})

await bench('ConvolverNode (short IR)', ctx => {
  let osc = ctx.createOscillator()
  let conv = ctx.createConvolver()
  conv.normalize = false
  let ir = ctx.createBuffer(1, 128, SR)
  ir.getChannelData(0)[0] = 1
  conv.buffer = ir
  osc.connect(conv)
  conv.connect(ctx.destination)
  osc.start(0)
})

await bench('3-node chain (osc→biquad→gain)', ctx => {
  let osc = ctx.createOscillator()
  let filt = ctx.createBiquadFilter()
  let gain = ctx.createGain()
  gain.gain.value = 0.5
  osc.connect(filt).connect(gain).connect(ctx.destination)
  osc.start(0)
})

console.log('\nDone.')
