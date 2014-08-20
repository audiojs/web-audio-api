var inherits = require('util').inherits,
  _ = require('underscore'),
  DspObject = require('./DspObject'),
  AudioInput = require('./audioports').AudioInput,
  AudioBuffer = require('audiobuffer'),
  BLOCK_SIZE = require('./constants').BLOCK_SIZE

var AudioParam = (function(super$0){var DP$0 = Object.defineProperty;var MIXIN$0 = function(t,s){for(var p in s){if(s.hasOwnProperty(p)){DP$0(t,p,Object.getOwnPropertyDescriptor(s,p));}}return t};"use strict";MIXIN$0(AudioParam, super$0);

  function AudioParam(context, defaultValue, rate) {
    super$0.call(this, context)

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
        this._toConstant()
        this._scheduled = []
      }
    })

    this._toConstant()

    // Using AudioNodes as inputs for AudioParam :
    // we have to set same channel attributes as for AudioNodes,
    // so the input knows how to do the mixing
    this.channelInterpretation = 'discrete'
    this.channelCount = 1
    this.channelCountMode = 'explicit'
    this._input = new AudioInput(this.context, this, 0)
  }AudioParam.prototype = Object.create(super$0.prototype, {"constructor": {"value": AudioParam, "configurable": true, "writable": true} });DP$0(AudioParam, "prototype", {"configurable": false, "enumerable": false, "writable": false});

  AudioParam.prototype.setValueAtTime = function(value, startTime) {
    var self = this
    this._schedule('SetValue', startTime, function() {
      self._instrinsicValue = value
      self._nextEvent()
    })
  }

  AudioParam.prototype.linearRampToValueAtTime = function(value, endTime) {
    var self = this
    this._schedule('LinearRampToValue', endTime, function() {
      self._instrinsicValue = value
      self._nextEvent()
    }, [value])
    this._nextEvent()
  }

  AudioParam.prototype.exponentialRampToValueAtTime = function(value, endTime) {
    var self = this
    if (this._instrinsicValue <= 0 || value <= 0)
      throw new Error('cannot create exponential ramp with value <= 0')
    this._schedule('ExponentialRampToValue', endTime, function() {
      self._instrinsicValue = value
      self._nextEvent()
    }, [value])
    this._nextEvent()
  }

  AudioParam.prototype.setTargetAtTime = function(target, startTime, timeConstant) {
    var self = this
    this._schedule('SetTarget', startTime, function() {
      self['_to_' + self._rate + 'Rate_setTarget'](target, timeConstant, function() {
        self._instrinsicValue = target
        self._nextEvent()
      })
    })
  }

  AudioParam.prototype.setValueCurveAtTime = function(values, startTime, duration) {
    var self = this
    this._schedule('SetValueCurve', startTime, function() {
      self['_to_' + self._rate + 'Rate_SetValueCurve'](values, startTime, duration, function() {
        self._instrinsicValue = values[values.length - 1]
        self._nextEvent()
      })
    })
  }

  AudioParam.prototype._nextEvent = function() {
    var event = this._scheduled[0]
    if (event) {
      if (event.type === 'LinearRampToValue')
        this['_to_' + this._rate + 'Rate_linearRamp'](event.args[0], event.time)
      else if (event.type === 'ExponentialRampToValue')
        this['_to_' + this._rate + 'Rate_exponentialRamp'](event.args[0], event.time)
      else this._toConstant()
    } else this._toConstant()
  }

  AudioParam.prototype._tick = function() {
    //DspObjectMixin._tick.apply(this, arguments)
    super$0.prototype._tick.call(this)
    var buffer = new AudioBuffer(1, BLOCK_SIZE, this.context.sampleRate)
    this._dsp(buffer.getChannelData(0))
    return buffer
  }

  // This method calculates intrinsic values
  AudioParam.prototype._dsp = function() {}

  // -------------------- DSP methods -------------------- //
  AudioParam.prototype._toConstant = function() {
    var value = this._instrinsicValue,
      i

    this._dsp = function(array) {
      for (i = 0; i < BLOCK_SIZE; i++) array[i] = value
    }
  }

  AudioParam.prototype._to_aRate_linearRamp = function(target, endTime) {
    var U0 = this._instrinsicValue,
      Un = U0,
      startTime = this.context.currentTime,
      step = (target - U0) / (endTime - startTime) * 1 / this.context.sampleRate,
      next = this._arithmeticSeries(U0, step),
      clip = step > 0 ? Math.min : Math.max,
      i

    this._dsp = function(array) {
      for (i = 0; i < BLOCK_SIZE; i++) {
        array[i] = clip(Un, target)
        Un = next()
      }
      this._instrinsicValue = array[BLOCK_SIZE - 1]
    }
  }

  AudioParam.prototype._to_kRate_linearRamp = function(target, endTime) {
    var U0 = this._instrinsicValue,
      Un = U0,
      startTime = this.context.currentTime,
      step = (target - U0) / (endTime - startTime) * BLOCK_SIZE / this.context.sampleRate,
      next = this._arithmeticSeries(U0, step),
      i

    this._dsp = function(array) {
      for (i = 0; i < BLOCK_SIZE; i++) array[i] = Un
      Un = next()
      this._instrinsicValue = array[BLOCK_SIZE - 1]
    }
  }

  AudioParam.prototype._to_aRate_exponentialRamp = function(target, timeEnd) {
    var timeStart = this.context.currentTime,
      U0 = this._instrinsicValue,
      Un = U0,
      ratio = Math.pow(target / U0, 1 / (this.context.sampleRate * (timeEnd - timeStart))),
      next = this._geometricSeries(U0, ratio),
      clip = ratio > 1 ? Math.min : Math.max,
      i

    this._dsp = function(array) {
      for (i = 0; i < BLOCK_SIZE; i++) {
        array[i] = clip(target, Un)
        Un = next()
      }
      this._instrinsicValue = array[BLOCK_SIZE - 1]
    }
  }

  AudioParam.prototype._to_kRate_exponentialRamp = function(target, timeEnd) {
    var timeStart = this.context.currentTime,
      U0 = this._instrinsicValue,
      Un = U0,
      ratio = Math.pow(target / U0, BLOCK_SIZE / (this.context.sampleRate * (timeEnd - timeStart))),
      next = this._geometricSeries(U0, ratio),
      i

    this._dsp = function(array) {
      for (i = 0; i < BLOCK_SIZE; i++) array[i] = Un
      Un = next()
      this._instrinsicValue = array[BLOCK_SIZE - 1]
    }
  }

  AudioParam.prototype._to_aRate_setTarget = function(target, Tc, onended) {
    var timeStart = this.context.currentTime,
      U0 = (this._instrinsicValue - target),
      Un = target + U0,
      ratio = Math.exp(-(1 / this.context.sampleRate) / Tc),
      next = this._geometricSeries(U0, ratio),
      clip = U0 > 0 ? Math.max : Math.min,
      i

    this._dsp = function(array) {
      for (i = 0; i < BLOCK_SIZE; i++) {
        array[i] = clip(Un, target)
        Un = target + next()
      }
      this._instrinsicValue = array[BLOCK_SIZE - 1]
      if (array[BLOCK_SIZE - 1] === target) onended()
    }
  }

  AudioParam.prototype._to_kRate_setTarget = function(target, Tc, onended) {
    var timeStart = this.context.currentTime,
      U0 = this._instrinsicValue - target,
      Un = target + U0,
      ratio = Math.exp(-(BLOCK_SIZE / this.context.sampleRate) / Tc),
      next = this._geometricSeries(U0, ratio),
      i

    this._dsp = function(array) {
      for (i = 0; i < BLOCK_SIZE; i++) array[i] = Un
      Un = target + next()
      this._instrinsicValue = array[BLOCK_SIZE - 1]
    }
  }

  AudioParam.prototype._to_aRate_SetValueCurve = function(values, startTime, duration, onended) {
    var valuesLength = values.length,
      coeff = valuesLength / duration,
      Ts = 1 / this.context.sampleRate,
      i, t

    this._dsp = function(array) {
      t = this.context.currentTime
      for (i = 0; i < BLOCK_SIZE; i++) {
        array[i] = values[Math.min(Math.round(coeff * (t - startTime)), valuesLength - 1)]
        t += Ts
      }
      this._instrinsicValue = array[BLOCK_SIZE - 1]
      if (t - startTime >= duration) onended()
    }
  }

  AudioParam.prototype._to_kRate_SetValueCurve = function(values, startTime, duration, onended) {
    var valuesLength = values.length,
      coeff = valuesLength / duration,
      Ts = 1 / this.context.sampleRate,
      i, val

    this._dsp = function(array) {
      val = values[Math.min(Math.round(coeff * (this.context.currentTime - startTime)), valuesLength - 1)]
      for (i = 0; i < BLOCK_SIZE; i++) array[i] = val
      this._instrinsicValue = array[BLOCK_SIZE - 1]
    }
  }

  AudioParam.prototype._geometricSeries = function(U0, ratio) {
    var Un = U0
    return function() {
      return Un *= ratio
    }
  }

  AudioParam.prototype._arithmeticSeries = function(U0, step) {
    var Un = U0
    return function() {
      return Un += step
    }
  }

  AudioParam.prototype.cancelScheduledValues = function(startTime) {
    throw new Error('implement me')
  }

;return AudioParam;})(DspObject);

module.exports = AudioParam
