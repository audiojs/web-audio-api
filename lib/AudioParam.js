var inherits = require('util').inherits
  , _ = require('underscore')
  , DspObject = require('./DspObject')

var AudioParam = function() {

  Object.defineProperty(this, 'value', {
    get: function() {},
    set: function() {}
  })

  Object.defineProperty(this, 'defaultValue', {
    writable: false
  })

}
inherits(AudioParam, DspObject)

_.extend(AudioParam.prototype, {

  setValueAtTime(value, startTime) {
    var self = this
    this._schedule(startTime, function() { self.value = value })
  },

  linearRampToValueAtTime(float value, double endTime) {

  },

  exponentialRampToValueAtTime(float value, double endTime) {

  },

  // Exponentially approach the target value with a rate having the given time constant. 
  setTargetAtTime(float target, double startTime, double timeConstant) {

  },

  // Sets an array of arbitrary parameter values starting at time for the given duration. 
  // The number of values will be scaled to fit into the desired duration. 
  setValueCurveAtTime(Float32Array values, double startTime, double duration) {

  },

  // Cancels all scheduled parameter changes with times greater than or equal to startTime. 
  cancelScheduledValues(double startTime) {

  }

})



    attribute float value;
    readonly attribute float defaultValue;
