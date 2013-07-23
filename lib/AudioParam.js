var inherits = require('util').inherits
  , _ = require('underscore')
  , DspObjectMixin = require('./DspObjectMixin')

var AudioParam = module.exports = function(context, defaultValue, rate) {
  DspObjectMixin.init(this, context)

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
    get: function() { return this._instrinsicValue },
    set: function(newVal) {
      this._instrinsicValue = newVal
      this._scheduled = []
    }
  })

  this._toConstant()
}
AudioParam.BLOCK_SIZE = 128

_.extend(AudioParam.prototype, DspObjectMixin, {

  setValueAtTime: function(value, startTime) {
    var self = this
    this._schedule('SetValue', startTime, function() {
      self._instrinsicValue = value
      self._nextEvent()
    })
  },

  linearRampToValueAtTime: function(value, endTime) {
    var self = this
    this._schedule('LinearRampToValue', endTime, function() {
      self._instrinsicValue = value
      self._nextEvent()
    }, [value])
    this._nextEvent()
  },

  exponentialRampToValueAtTime: function(value, endTime) {
    var self = this
    if (this._instrinsicValue <= 0 || value <= 0)
      throw new Error('cannot create exponential ramp with value <= 0')
    this._schedule('ExponentialRampToValue', endTime, function() {
      self._instrinsicValue = value
      self._nextEvent()
    }, [value])
    this._nextEvent()
  },

  setTargetAtTime: function(target, startTime, timeConstant) {
    var self = this
    this._schedule('SetTarget', startTime, function() {
      self['_to_'+self._rate+'Rate_setTarget'](target, timeConstant, function() {
        self._instrinsicValue = target
        self._nextEvent()
      })
    })
  },

  setValueCurveAtTime: function(values, startTime, duration) {
    var self = this
    this._schedule('SetValueCurve', startTime, function() {
      self['_to_'+self._rate+'Rate_SetValueCurve'](values, startTime, duration, function() {
        self._instrinsicValue = values[values.length - 1]
        self._nextEvent()
      })
    })
  },

  _nextEvent: function() {
    var event = this._scheduled[0]
    if (event) {
      if (event.type === 'LinearRampToValue')
        this['_to_'+this._rate+'Rate_linearRamp'](event.args[0], event.time)
      else if (event.type === 'ExponentialRampToValue')
        this['_to_'+this._rate+'Rate_exponentialRamp'](event.args[0], event.time)
      else this._toConstant()
    } else this._toConstant()
  },

  _tick: function() {
    DspObjectMixin._tick.apply(this, arguments)
    var buffer = []
    this._dsp(buffer)
    return buffer
  },

  _dsp: function() {},

  // -------------------- DSP methods -------------------- //
  _toConstant: function() {
    var value = this._instrinsicValue
      , blockSize = AudioParam.BLOCK_SIZE
      , i

    this._dsp = function(buffer) {
      for(i = 0; i < blockSize; i++) buffer[i] = value
    }
  },

  _to_aRate_linearRamp: function(target, endTime) {
    var blockSize = AudioParam.BLOCK_SIZE
      , U0 = this._instrinsicValue, Un = U0
      , startTime = this.context.currentTime
      , step = (target - U0) / (endTime - startTime) * 1 / this.context.sampleRate
      , next = this._arithmeticSeries(U0, step)
      , clip = step > 0 ? Math.min : Math.max
      , i

    this._dsp = function(buffer) {
      for (i = 0; i < blockSize; i++) {
        buffer[i] = clip(Un, target)
        Un = next()
      }
      this._instrinsicValue = buffer[blockSize - 1]
    }
  },

  _to_kRate_linearRamp: function(target, endTime) {
    var blockSize = AudioParam.BLOCK_SIZE
      , U0 = this._instrinsicValue, Un = U0
      , startTime = this.context.currentTime
      , step = (target - U0) / (endTime - startTime) * blockSize / this.context.sampleRate
      , next = this._arithmeticSeries(U0, step)
      , i

    this._dsp = function(buffer) {
      for (i = 0; i < blockSize; i++) buffer[i] = Un
      Un = next()
      this._instrinsicValue = buffer[blockSize - 1]
    }
  },

  _to_aRate_exponentialRamp: function(target, timeEnd) {
    var timeStart = this.context.currentTime
      , blockSize = AudioParam.BLOCK_SIZE
      , U0 = this._instrinsicValue, Un = U0
      , ratio = Math.pow(target / U0, 1 / (this.context.sampleRate * (timeEnd - timeStart)))
      , next = this._geometricSeries(U0, ratio)
      , clip = ratio > 1 ? Math.min : Math.max
      , i

    this._dsp = function(buffer) {
      for (i = 0; i < blockSize; i++) {
        buffer[i] = clip(target, Un)
        Un = next()
      }
      this._instrinsicValue = buffer[blockSize - 1]
    }
  },

  _to_kRate_exponentialRamp: function(target, timeEnd) {
    var timeStart = this.context.currentTime
      , blockSize = AudioParam.BLOCK_SIZE
      , U0 = this._instrinsicValue, Un = U0
      , ratio = Math.pow(target / U0, blockSize / (this.context.sampleRate * (timeEnd - timeStart)))
      , next = this._geometricSeries(U0, ratio)
      , i

    this._dsp = function(buffer) {
      for (i = 0; i < blockSize; i++) buffer[i] = Un
      Un = next()
      this._instrinsicValue = buffer[blockSize - 1]
    }
  },

  _to_aRate_setTarget: function(target, Tc, done) {
    var timeStart = this.context.currentTime
      , U0 = (this._instrinsicValue - target), Un = target + U0
      , ratio = Math.exp(-(1 / this.context.sampleRate) / Tc)
      , next = this._geometricSeries(U0, ratio)
      , blockSize = AudioParam.BLOCK_SIZE
      , clip = U0 > 0 ? Math.max : Math.min
      , i

    this._dsp = function(buffer) {
      for (i = 0; i < blockSize; i++) {
        buffer[i] = clip(Un, target)
        Un = target + next()
      }
      this._instrinsicValue = buffer[blockSize - 1]
      if (buffer[blockSize.length - 1] === target) done()
    }
  },

  _to_kRate_setTarget: function(target, Tc, done) {
    var timeStart = this.context.currentTime
      , blockSize = AudioParam.BLOCK_SIZE
      , U0 = this._instrinsicValue - target, Un = target + U0
      , ratio = Math.exp(-(blockSize / this.context.sampleRate) / Tc)
      , next = this._geometricSeries(U0, ratio)
      , i

    this._dsp = function(buffer) {
      for (i = 0; i < blockSize; i++) buffer[i] = Un
      Un = target + next()
      this._instrinsicValue = buffer[blockSize - 1]
    }
  },

  _to_aRate_SetValueCurve: function(values, startTime, duration, done) {
    var valuesLength = values.length
      , coeff = valuesLength / duration
      , Ts = 1 / this.context.sampleRate
      , blockSize = AudioParam.BLOCK_SIZE
      , i, t

    this._dsp = function(buffer) {
      t = this.context.currentTime
      for (i = 0; i < blockSize; i++) {
        buffer[i] = values[Math.min(Math.round(coeff * (t - startTime)), valuesLength - 1)]
        t += Ts
      }
      this._instrinsicValue = buffer[blockSize - 1]
      if (t - startTime >= duration) done()
    }
  },

  _to_kRate_SetValueCurve: function(values, startTime, duration, done) {
    var valuesLength = values.length
      , coeff = valuesLength / duration
      , Ts = 1 / this.context.sampleRate
      , blockSize = AudioParam.BLOCK_SIZE
      , i, val

    this._dsp = function(buffer) {
      val = values[Math.min(Math.round(coeff * (this.context.currentTime - startTime)), valuesLength - 1)]
      for (i = 0; i < blockSize; i++) buffer[i] = val
      this._instrinsicValue = buffer[blockSize - 1]
    }
  },

  _geometricSeries: function(U0, ratio) {
    var Un = U0
    return function() { return Un *= ratio }
  },

  _arithmeticSeries: function(U0, step) {
    var Un = U0
    return function() { return Un += step }
  },

  cancelScheduledValues: function(startTime) {
    throw new Error('implement me')
  }

})
