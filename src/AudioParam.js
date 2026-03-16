import DspObject from './DspObject.js'
import { AudioInput } from './audioports.js'
import { BLOCK_SIZE } from './constants.js'
import { AutomationEventList, createExponentialRampToValueAutomationEvent, createLinearRampToValueAutomationEvent, createSetTargetAutomationEvent, createSetValueAutomationEvent, createSetValueCurveAutomationEvent } from 'automation-events';

class AudioParam extends DspObject {

  #defaultValue
  #instrinsicValue
  #rate
  #automationEventList

  get defaultValue() { return this.#defaultValue }

  get value() { return this.#instrinsicValue }
  set value(newVal) {
    this.#instrinsicValue = newVal
    this.#automationEventList.add(createSetValueAutomationEvent(newVal, this.context.currentTime))
  }

  constructor(context, defaultValue, rate) {
    super(context)

    if (typeof defaultValue !== 'number')
      throw new Error('defaultValue must be a number')

    this.#rate = rate || 'k'
    if (this.#rate !== 'a' && this.#rate !== 'k')
      throw new Error('invalid rate, must be a or k')

    this.#defaultValue = defaultValue
    this.#instrinsicValue = defaultValue
    this.#automationEventList = new AutomationEventList(defaultValue)

    // AudioParam can accept node connections as modulation input
    this.channelInterpretation = 'discrete'
    this.channelCount = 1
    this.channelCountMode = 'explicit'
    this._input = new AudioInput(this.context, this, 0)
    this._outBuf = new Float32Array(BLOCK_SIZE)
  }

  setValueAtTime(value, startTime) {
    this.#automationEventList.add(createSetValueAutomationEvent(value, startTime))
  }

  linearRampToValueAtTime(value, endTime) {
    this.#automationEventList.add(createLinearRampToValueAutomationEvent(value, endTime))
  }

  exponentialRampToValueAtTime(value, endTime) {
    if (this.#instrinsicValue <= 0 || value <= 0)
      throw new Error('cannot create exponential ramp with value <= 0')
    this.#automationEventList.add(createExponentialRampToValueAutomationEvent(value, endTime))
  }

  setTargetAtTime(target, startTime, timeConstant) {
    this.#automationEventList.add(createSetTargetAutomationEvent(target, startTime, timeConstant))
  }

  setValueCurveAtTime(values, startTime, duration) {
    this.#automationEventList.add(createSetValueCurveAutomationEvent(values, startTime, duration))
  }

  _tick() {
    super._tick()
    this._dsp(this._outBuf)
    return this._outBuf
  }

  _dsp(array) {
    if (this.#rate === 'a') {
      for (let i = 0; i < BLOCK_SIZE; i++)
        array[i] = this.#automationEventList.getValue(this.context.currentTime + i / this.context.sampleRate)
    } else {
      let val = this.#automationEventList.getValue(this.context.currentTime)
      for (let i = 0; i < BLOCK_SIZE; i++)
        array[i] = val
    }
    this.#instrinsicValue = array[BLOCK_SIZE - 1]
  }

  cancelScheduledValues(startTime) {
    throw new Error('implement me')
  }

}

export default AudioParam
