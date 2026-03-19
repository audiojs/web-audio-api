import DspObject from './DspObject.js'
import { AudioInput } from './audioports.js'
import { BLOCK_SIZE } from './constants.js'
import { AutomationEventList, createCancelAndHoldAutomationEvent, createCancelScheduledValuesAutomationEvent, createExponentialRampToValueAutomationEvent, createLinearRampToValueAutomationEvent, createSetTargetAutomationEvent, createSetValueAutomationEvent, createSetValueCurveAutomationEvent } from 'automation-events'
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
    newVal = Math.min(this.#maxValue, Math.max(this.#minValue, newVal))
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
    startTime = Math.max(startTime, this.context.currentTime)
    this._assertNotInCurve(startTime)
    this.#automationEventList.add(createSetValueAutomationEvent(value, startTime))
    return this
  }

  linearRampToValueAtTime(value, endTime) {
    _assertFinite(value)
    _assertTime(endTime)
    endTime = Math.max(endTime, this.context.currentTime)
    this._assertNotInCurve(endTime)
    this.#automationEventList.add(createLinearRampToValueAutomationEvent(value, endTime))
    return this
  }

  exponentialRampToValueAtTime(value, endTime) {
    _assertFinite(value)
    _assertTime(endTime)
    if (Math.fround(value) === 0)
      throw new RangeError('exponentialRamp target value must be non-zero')
    endTime = Math.max(endTime, this.context.currentTime)
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
    startTime = Math.max(startTime, this.context.currentTime)
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
    startTime = Math.max(startTime, this.context.currentTime)
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

  // Wraps AutomationEventList.getValue to fix exponentialRamp with opposite-sign
  // or zero start values. The spec says: if v0 and v1 have opposite signs or v0
  // is zero, v(t) = v0 for T0 <= t < T1. The library returns 0 in this case.
  #getValue(time) {
    let val = this.#automationEventList.getValue(time)
    if (val === 0) {
      let events = this.#automationEventList._automationEvents
      for (let i = 0; i < events.length; i++) {
        let e = events[i]
        if (e.type === 'exponentialRampToValue' && time < e.endTime) {
          // Find the previous event's end value (the ramp's start value)
          let prev = events[i - 1]
          let v0 = prev === undefined ? this.#defaultValue
            : prev.type === 'setValueCurve' ? prev.values[prev.values.length - 1]
            : prev.value
          // Spec: opposite signs or v0 == 0 → hold v0
          if ((v0 > 0 && e.value < 0) || (v0 < 0 && e.value > 0) || v0 === 0)
            return v0
          break
        }
      }
    }
    return val
  }

  _tick() {
    super._tick()
    this._dsp(this._outBuf)
    return this._outBuf
  }

  _dsp(array) {
    if (this.#rate === 'a') {
      for (let i = 0; i < BLOCK_SIZE; i++)
        array[i] = this.#getValue(this.context.currentTime + i / this.context.sampleRate)
    } else {
      let val = this.#getValue(this.context.currentTime)
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
    this.#automationEventList.add(createCancelScheduledValuesAutomationEvent(startTime))
    return this
  }

  cancelAndHoldAtTime(cancelTime) {
    _assertTime(cancelTime)

    // Snapshot setValueCurve events that span cancelTime so we can fix
    // truncation precision after the library processes the cancelAndHold.
    let events = this.#automationEventList._automationEvents
    let origCurve = null
    for (let e of events) {
      if (e.type === 'setValueCurve' &&
          e.startTime < cancelTime &&
          e.startTime + e.duration > cancelTime) {
        origCurve = {
          values: Array.from(e.values),  // copy as float64
          startTime: e.startTime,
          duration: e.duration
        }
        break
      }
    }

    this.#automationEventList.add(createCancelAndHoldAutomationEvent(cancelTime))

    events = this.#automationEventList._automationEvents

    // Fix truncated setValueCurve precision: the library resamples curve values
    // through Float32Array which loses precision. Recompute in float64.
    if (origCurve) {
      let last = events[events.length - 1]
      if (last && last.type === 'setValueCurve' &&
          last.startTime === origCurve.startTime) {
        let newDuration = cancelTime - origCurve.startTime
        let ratio = (origCurve.values.length - 1) / origCurve.duration
        let length = Math.max(2, 1 + Math.ceil(newDuration * ratio))
        let fraction = (newDuration / (length - 1)) * ratio
        let values = origCurve.values.slice(0, length)
        if (fraction < 1) {
          for (let i = 1; i < length; i++) {
            let factor = (fraction * i) % 1
            values[i] = origCurve.values[i - 1] * (1 - factor) + origCurve.values[i] * factor
          }
        }
        last.values = values
        last.duration = newDuration
      }
    }

    // The library stores held values (truncated ramp endpoints, setValue for
    // setTarget) in float64. But the Web Audio spec outputs through Float32Array,
    // so subsequent automations should start from the float32-rounded held value.
    // Apply Math.fround to the last event's value to match spec precision.
    let last = events[events.length - 1]
    if (last) {
      if ((last.type === 'linearRampToValue' || last.type === 'exponentialRampToValue')
          && last.endTime === cancelTime) {
        last.value = Math.fround(last.value)
      } else if (last.type === 'setValue' && last.startTime === cancelTime) {
        last.value = Math.fround(last.value)
      }
    }

    return this
  }

}

export default AudioParam
