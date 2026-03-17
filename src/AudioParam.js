import DspObject from './DspObject.js'
import { AudioInput } from './audioports.js'
import { BLOCK_SIZE } from './constants.js'
import { AutomationEventList, createExponentialRampToValueAutomationEvent, createLinearRampToValueAutomationEvent, createSetTargetAutomationEvent, createSetValueAutomationEvent, createSetValueCurveAutomationEvent } from 'automation-events';

class AudioParam extends DspObject {

  #defaultValue
  #intrinsicValue
  #rate
  #automationEventList
  #minValue
  #maxValue

  get defaultValue() { return this.#defaultValue }
  get minValue() { return this.#minValue }
  get maxValue() { return this.#maxValue }

  get automationRate() { return this.#rate === 'a' ? 'a-rate' : 'k-rate' }
  set automationRate(val) { this.#rate = val === 'k-rate' ? 'k' : 'a' }

  get value() { return this.#intrinsicValue }
  set value(newVal) {
    this.#intrinsicValue = newVal
    this.#automationEventList.add(createSetValueAutomationEvent(newVal, this.context.currentTime))
  }

  constructor(context, defaultValue, rate, minValue, maxValue) {
    super(context)

    if (typeof defaultValue !== 'number')
      throw new Error('defaultValue must be a number')

    this.#rate = rate || 'k'
    this.#minValue = minValue ?? -3.4028234663852886e38
    this.#maxValue = maxValue ?? 3.4028234663852886e38
    if (this.#rate !== 'a' && this.#rate !== 'k')
      throw new Error('invalid rate, must be a or k')

    this.#defaultValue = defaultValue
    this.#intrinsicValue = defaultValue
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
    if (this.#intrinsicValue <= 0 || value <= 0)
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
    this.#intrinsicValue = array[BLOCK_SIZE - 1]
  }

  cancelScheduledValues(startTime) {
    // Remove all events at or after startTime by rebuilding the list
    let keep = [...this.#automationEventList].filter(e => e.startTime < startTime)
    this.#automationEventList = new AutomationEventList(this.#defaultValue)
    for (let e of keep) this.#automationEventList.add(e)
  }

  cancelAndHoldAtTime(cancelTime) {
    let val = this.#automationEventList.getValue(cancelTime)
    this.cancelScheduledValues(cancelTime)
    this.setValueAtTime(val, cancelTime)
  }

}

export default AudioParam
