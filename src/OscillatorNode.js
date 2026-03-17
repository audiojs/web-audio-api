import AudioScheduledSourceNode from './AudioScheduledSourceNode.js'
import AudioNode from './AudioNode.js'
import AudioParam from './AudioParam.js'
import AudioBuffer from 'audio-buffer'
import PeriodicWave, { TABLE_SIZE } from './PeriodicWave.js'
import { BLOCK_SIZE } from './constants.js'

const TYPES = ['sine', 'square', 'sawtooth', 'triangle', 'custom']

class OscillatorNode extends AudioScheduledSourceNode {

  #frequency
  #detune
  #type = 'sine'
  #periodicWave = null
  #phase = 0

  get frequency() { return this.#frequency }
  get detune() { return this.#detune }

  get type() { return this.#type }
  set type(val) {
    if (!TYPES.includes(val)) throw new Error('Invalid oscillator type: ' + val)
    if (val === 'custom') throw new Error('Cannot set type to custom; use setPeriodicWave()')
    this.#type = val
    this.#periodicWave = null
  }

  constructor(context, options) {
    options = AudioNode._checkOpts(options)
    super(context, 0, 1, undefined, 'max', 'speakers')
    this.#frequency = new AudioParam(this.context, options.frequency ?? 440, 'a')
    this.#detune = new AudioParam(this.context, options.detune ?? 0, 'a')
    if (options.periodicWave) this.setPeriodicWave(options.periodicWave)
    else if (options.type !== undefined) this.type = options.type
    this._outBuf = new AudioBuffer(1, BLOCK_SIZE, context.sampleRate)
    this._applyOpts(options)
  }

  setPeriodicWave(wave) {
    if (!(wave instanceof PeriodicWave)) throw new Error('Expected PeriodicWave')
    this.#periodicWave = wave
    this.#type = 'custom'
  }

  _dsp() {
    let freqArr = this.#frequency._tick()
    let detuneArr = this.#detune._tick()
    let out = this._outBuf.getChannelData(0)
    let sr = this.context.sampleRate
    let table = this.#periodicWave?.table ?? PeriodicWave.getBuiltIn(this.#type)
    let phase = this.#phase

    for (let i = 0; i < BLOCK_SIZE; i++) {
      let freq = freqArr[i] * (2 ** (detuneArr[i] / 1200))

      // linear interpolation for smooth wavetable lookup
      let pos = phase * TABLE_SIZE
      let idx = Math.floor(pos)
      let frac = pos - idx
      let a = table[idx % TABLE_SIZE]
      let b = table[(idx + 1) % TABLE_SIZE]
      out[i] = a + (b - a) * frac

      phase += freq / sr
      phase -= Math.floor(phase) // keep in [0, 1)
    }

    this.#phase = phase
    return this._outBuf
  }
}

export default OscillatorNode
