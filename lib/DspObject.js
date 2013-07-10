var _ = require('underscore')

var DspObject = module.exports = function(context) {
  this._frame = 0
  this._context = context
  this._scheduled = []
}

_.extend(DspObject.prototype, {

  _tick: function() {
  	this._frame++
    var event = this._scheduled.shift()
    while(event && event.time <= this._context.currentTime) {
      event.func()
      event = this._scheduled.shift()
    }
    if (event) this._scheduled.unshift(event)
  },

  _schedule: function(func, time) {
  	var event = {time: time, func: func}
      , ind = _.sortedIndex(this._scheduled, event, function(e) { return e.time }) 
  	this._scheduled.splice(ind, 0, event)
  },

  _currentTime: function() {}

})