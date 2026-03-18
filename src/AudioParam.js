import DspObject from './DspObject.js'
import { AudioInput } from './audioports.js'
import { BLOCK_SIZE } from './constants.js'
import { AutomationEventList, createExponentialRampToValueAutomationEvent, createLinearRampToValueAutomationEvent, createSetTargetAutomationEvent, createSetValueAutomationEvent, createSetValueCurveAutomationEvent } from 'automation-events'
import { DOMErr } from './errors.js'


let _assertTime = (t) => {
  if (typeof t !== 'number' || isNaN(t) || t === Infinity || t === -Infinity)
    throw new TypeError('time must be a finite number')
  if (t < 0)
    throw new RangeError('time must be non-negative')
}

let _assertFinite = (v) => {
  if (typeof v !== 'number' || !isFinite(v))
    throw new TypeError('value must be a finite number')
}

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
  set automationRate(val) {
    if (this._fixedRate)
      throw DOMErr('automationRate is fixed and cannot be changed', 'InvalidStateError')
    this.#rate = val === 'k-rate' ? 'k' : 'a'
  }

  get value() { return Math.fround(this.#intrinsicValue) }
  set value(newVal) {
    let t = this.context.currentTime
    this._assertNotInCurve(t)
    newVal = Math.fround(newVal)
    this.#intrinsicValue = newVal
    this.#automationEventList.add(createSetValueAutomationEvent(newVal, t))
  }

  // Throws NotSupportedError if time falls within an existing setValueCurve
  _assertNotInCurve(time) {
    for (let e of this.#automationEventList) {
      if (e.type === 'setValueCurve') {
        let eEnd = e.startTime + e.duration
        if (time >= e.startTime && time < eEnd)
          throw DOMErr('Cannot set value during a setValueCurve', 'NotSupportedError')
      }
    }
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
    _assertFinite(value)
    _assertTime(startTime)
    this._assertNotInCurve(startTime)
    this.#automationEventList.add(createSetValueAutomationEvent(value, startTime))
    return this
  }

  linearRampToValueAtTime(value, endTime) {
    _assertFinite(value)
    _assertTime(endTime)
    this._assertNotInCurve(endTime)
    this.#automationEventList.add(createLinearRampToValueAutomationEvent(value, endTime))
    return this
  }

  exponentialRampToValueAtTime(value, endTime) {
    _assertFinite(value)
    _assertTime(endTime)
    if (Math.fround(value) === 0)
      throw new RangeError('exponentialRamp target value must be non-zero')
    this._assertNotInCurve(endTime)
    this.#automationEventList.add(createExponentialRampToValueAutomationEvent(value, endTime))
    return this
  }

  setTargetAtTime(target, startTime, timeConstant) {
    _assertFinite(target)
    _assertTime(startTime)
    _assertFinite(timeConstant)
    if (timeConstant < 0)
      throw new RangeError('timeConstant must be non-negative')
    this._assertNotInCurve(startTime)
    this.#automationEventList.add(createSetTargetAutomationEvent(target, startTime, timeConstant))
    return this
  }

  setValueCurveAtTime(values, startTime, duration) {
    _assertTime(startTime)
    _assertFinite(duration)
    if (duration <= 0)
      throw new RangeError('duration must be strictly positive')
    if (!values || values.length < 2)
      throw DOMErr('setValueCurve requires at least 2 values', 'InvalidStateError')
    for (let i = 0; i < values.length; i++)
      _assertFinite(values[i])
    // Check for overlap: setValueCurve cannot overlap any other automation event
    let endTime = startTime + duration
    for (let e of this.#automationEventList) {
      let eTime = e.startTime ?? e.endTime
      if (e.type === 'setValueCurve') {
        let eEnd = e.startTime + e.duration
        if (startTime < eEnd && endTime > e.startTime)
          throw DOMErr('setValueCurveAtTime overlaps an existing setValueCurve', 'NotSupportedError')
      } else {
        // Any other event strictly inside (startTime, endTime) of the new curve is an overlap
        if (eTime > startTime && eTime < endTime)
          throw DOMErr('setValueCurveAtTime overlaps an existing event', 'NotSupportedError')
      }
    }
    this.#automationEventList.add(createSetValueCurveAutomationEvent(values, startTime, duration))
    return this
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

    // Add connected node inputs (spec: computedValue = intrinsicValue + sum(inputs))
    if (this._input.sources.length > 0) {
      let inputBuf = this._input._tick()
      let ch0 = inputBuf.getChannelData(0)
      if (this.#rate === 'a') {
        for (let i = 0; i < BLOCK_SIZE; i++)
          array[i] += ch0[i]
      } else {
        // k-rate: use only the first sample of the input
        let inputVal = ch0[0]
        for (let i = 0; i < BLOCK_SIZE; i++)
          array[i] += inputVal
      }
    }

    // Spec: flush NaN to default value
    let def = this.#defaultValue
    for (let i = 0; i < BLOCK_SIZE; i++)
      if (isNaN(array[i])) array[i] = def

    this.#intrinsicValue = array[BLOCK_SIZE - 1]
  }

  cancelScheduledValues(startTime) {
    _assertTime(startTime)
    // Remove all events at or after startTime by rebuilding the list
    // For ramp events, use endTime; for setValueCurve, remove if range includes startTime
    let keep = [...this.#automationEventList].filter(e => {
      let eTime = e.startTime ?? e.endTime
      if (e.type === 'setValueCurve') {
        let eEnd = e.startTime + e.duration
        return eEnd <= startTime  // keep only if curve ends before cancelTime
      }
      return eTime < startTime
    })
    this.#automationEventList = new AutomationEventList(this.#defaultValue)
    for (let e of keep) this.#automationEventList.add(e)
    return this
  }

  cancelAndHoldAtTime(cancelTime) {
    _assertTime(cancelTime)
    let val = this.#automationEventList.getValue(cancelTime)
    this.cancelScheduledValues(cancelTime)
    this.setValueAtTime(val, cancelTime)
    return this
  }

}

export default AudioParam
