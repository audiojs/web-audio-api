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
  #paramVersion = 0   // incremented on every automation mutation
  #cachedVersion = -1 // version when cache was set
  #cachedValue = 0    // cached fill value (valid when version matches)

  get defaultValue() { return this.#defaultValue }
  get minValue() { return this.#minValue }
  get maxValue() { return this.#maxValue }

  get automationRate() { return this.#rate === 'a' ? 'a-rate' : 'k-rate' }
  set automationRate(val) {
    if (this._fixedRate)
      throw DOMErr('automationRate is fixed and cannot be changed', 'InvalidStateError')
    this.#rate = val === 'k-rate' ? 'k' : 'a'
  }

  get value() {
    let v = this.#intrinsicValue
    v = Math.min(this.#maxValue, Math.max(this.#minValue, v))
    return Math.fround(v)
  }
  set value(newVal) {
    let t = this.context.currentTime
    this._assertNotInCurve(t)
    this.#intrinsicValue = newVal
    this.#automationEventList.add(createSetValueAutomationEvent(newVal, t))
    this.#paramVersion++
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
    this._input._useFloat64 = true
    this._outBuf = new Float64Array(BLOCK_SIZE)
  }

  setValueAtTime(value, startTime) {
    _assertFinite(value)
    _assertTime(startTime)
    startTime = Math.max(startTime, this.context.currentTime)
    this._assertNotInCurve(startTime)
    this.#automationEventList.add(createSetValueAutomationEvent(value, startTime))
    this.#paramVersion++
    return this
  }

  linearRampToValueAtTime(value, endTime) {
    _assertFinite(value)
    _assertTime(endTime)
    endTime = Math.max(endTime, this.context.currentTime)
    this._assertNotInCurve(endTime)
    this.#automationEventList.add(createLinearRampToValueAutomationEvent(value, endTime))
    this.#paramVersion++
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
    this.#paramVersion++
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
    this.#paramVersion++
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
    // Store as regular Array to ensure float64 interpolation during truncation
    // (Float32Array.slice preserves type, causing float32 precision loss)
    if (ArrayBuffer.isView(values)) values = Array.from(values)
    this.#automationEventList.add(createSetValueCurveAutomationEvent(values, startTime, duration))
    this.#paramVersion++
    return this
  }

  _tick() {
    super._tick()
    this._dsp(this._outBuf)
    return this._outBuf
  }

  _dsp(array) {
    let hasInput = this._input.sources.length > 0

    // Fast path: truly static param (no events, no input) — skip getValue entirely
    if (!hasInput && this.#cachedVersion === this.#paramVersion
        && !this.#automationEventList._automationEvents.length) {
      array.fill(this.#cachedValue)
      this.#intrinsicValue = this.#cachedValue
      return
    }

    let sr = this.context.sampleRate
    let f0 = this.context._frame ?? Math.round(this.context.currentTime * sr)

    if (this.#rate === 'a') {
      if (hasInput) {
        let inputBuf = this._input._tick()
        let ch0 = inputBuf.getChannelData(0)
        for (let i = 0; i < BLOCK_SIZE; i++)
          array[i] = this.#automationEventList.getValue((f0 + i) / sr) + ch0[i]
        // NaN can enter from input — flush to default
        let def = this.#defaultValue
        for (let i = 0; i < BLOCK_SIZE; i++) if (isNaN(array[i])) array[i] = def
      } else {
        let v0 = this.#automationEventList.getValue(f0 / sr)
        let v1 = this.#automationEventList.getValue((f0 + BLOCK_SIZE - 1) / sr)
        if (v0 === v1) {
          array.fill(v0)
          this.#cachedVersion = this.#paramVersion
          this.#cachedValue = v0
        } else {
          this.#cachedVersion = -1
          for (let i = 0; i < BLOCK_SIZE; i++)
            array[i] = this.#automationEventList.getValue((f0 + i) / sr)
        }
      }
    } else {
      let val = this.#automationEventList.getValue(f0 / sr)
      if (hasInput) {
        let inputBuf = this._input._tick()
        val += inputBuf.getChannelData(0)[0]
        if (isNaN(val)) val = this.#defaultValue
      } else if (!this.#automationEventList._automationEvents.length) {
        this.#cachedVersion = this.#paramVersion
        this.#cachedValue = val
      }
      array.fill(val)
    }

    this.#intrinsicValue = array[BLOCK_SIZE - 1]
  }

  cancelScheduledValues(startTime) {
    _assertTime(startTime)
    this.#automationEventList.add(createCancelScheduledValuesAutomationEvent(startTime))
    this.#paramVersion++
    return this
  }

  cancelAndHoldAtTime(cancelTime) {
    _assertTime(cancelTime)

    this.#automationEventList.add(createCancelAndHoldAutomationEvent(cancelTime))
    this.#paramVersion++

    // The library stores held values in float64, but Web Audio spec outputs
    // through Float32Array — subsequent automations must start from the
    // float32-rounded held value. Apply Math.fround to match spec precision.
    let events = this.#automationEventList._automationEvents
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
