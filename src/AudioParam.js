import DspObject from './DspObject.js'
import { AudioInput } from './audioports.js'
import AudioBuffer from './AudioBuffer.js'
import { BLOCK_SIZE } from './constants.js'
import { AutomationEventList, createExponentialRampToValueAutomationEvent, createLinearRampToValueAutomationEvent, createSetTargetAutomationEvent, createSetValueAutomationEvent, createSetValueCurveAutomationEvent } from 'automation-events';

class AudioParam extends DspObject {

  constructor(context, defaultValue, rate) {
    super(context)

    if (typeof defaultValue !== 'number')
      throw new Error('defaultValue must be a number')

    rate = rate || 'k'
    if (rate !== 'a' && rate !== 'k')
      throw new Error('invalid rate, must be a or k')
    this._rate = rate

    Object.defineProperty(this, 'defaultValue', {
      value: defaultValue,
      writable: false
    })

    this._instrinsicValue = defaultValue
    Object.defineProperty(this, 'value', {
      get: function() {
        return this._instrinsicValue
      },
      set: function(newVal) {
        this._instrinsicValue = newVal
        this._automationEventList.add(createSetValueAutomationEvent(newVal, this.context.currentTime))
      }
    })

    this._automationEventList = new AutomationEventList(defaultValue)
    // Using AudioNodes as inputs for AudioParam :
    // we have to set same channel attributes as for AudioNodes,
    // so the input knows how to do the mixing
    this.channelInterpretation = 'discrete'
    this.channelCount = 1
    this.channelCountMode = 'explicit'
    this._input = new AudioInput(this.context, this, 0)
  }

  setValueAtTime(value, startTime) {
    this._automationEventList.add(createSetValueAutomationEvent(value, startTime))
  }

  linearRampToValueAtTime(value, endTime) {
    this._automationEventList.add(createLinearRampToValueAutomationEvent(value, endTime))
  }

  exponentialRampToValueAtTime(value, endTime) {
    if (this._instrinsicValue <= 0 || value <= 0)
      throw new Error('cannot create exponential ramp with value <= 0')
    this._automationEventList.add(createExponentialRampToValueAutomationEvent(value, endTime))
  }

  setTargetAtTime(target, startTime, timeConstant) {
    this._automationEventList.add(createSetTargetAutomationEvent(target, startTime, timeConstant))
  }

  setValueCurveAtTime(values, startTime, duration) {
    this._automationEventList.add(createSetValueCurveAutomationEvent(values, startTime, duration))
  }

  _tick() {
    super._tick()
    var buffer = new AudioBuffer(1, BLOCK_SIZE, this.context.sampleRate)
    this._dsp(buffer.getChannelData(0))
    return buffer
  }

  // This method calculates intrinsic values
  _dsp(array) {
    var i

    if (this._rate === 'a') {
      for (i = 0; i < BLOCK_SIZE; i++) {
        array[i] = this._automationEventList.getValue(this.context.currentTime + i / this.context.sampleRate)
      }
    } else {
      var value = this._automationEventList.getValue(this.context.currentTime)

      for (i = 0; i < BLOCK_SIZE; i++) {
        array[i] = value
      }
    }
    this._instrinsicValue = array[BLOCK_SIZE - 1]
  }

  cancelScheduledValues(startTime) {
    throw new Error('implement me')
  }

}

export default AudioParam
