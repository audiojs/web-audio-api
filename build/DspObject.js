var _ = require('underscore')
var events = require('events')

var DspObject = (function(super$0){var DP$0 = Object.defineProperty;var MIXIN$0 = function(t,s){for(var p in s){if(s.hasOwnProperty(p)){DP$0(t,p,Object.getOwnPropertyDescriptor(s,p));}}return t};"use strict";MIXIN$0(DspObject, super$0);

  function DspObject(context) {
    super$0.call(this)
    this.context = context
    this._scheduled = []
  }DspObject.prototype = Object.create(super$0.prototype, {"constructor": {"value": DspObject, "configurable": true, "writable": true} });DP$0(DspObject, "prototype", {"configurable": false, "enumerable": false, "writable": false});

  DspObject.prototype._tick = function() {
    this._frame++
    var event = this._scheduled.shift(),
      eventsSameTime, eventsToExecute = [],
      previousTime
      // Gather all events that need to be executed at this tick
    while (event && event.time <= this.context.currentTime) {
      previousTime = event.time
      eventsSameTime = []
      // Gather all the events with same time
      while (event && event.time === previousTime) {
        // Add the event only if there isn't already events with same type
        if (eventsSameTime.every(function(other) {
          return event.type !== other.type
        })) eventsSameTime.push(event)
        event = this._scheduled.shift()
      }
      eventsSameTime.forEach(function(event) {
        eventsToExecute.push(event)
      })
    }
    if (event) this._scheduled.unshift(event)
      // And execute
    eventsToExecute.reverse().forEach(function(event) {
      event.func && event.func();
    })
  }

  DspObject.prototype._schedule = function(type, time, func, args) {
    var event = {
        time: time,
        func: func,
        type: type
      },
      ind = _.sortedIndex(this._scheduled, event, function(e) {
        return e.time
      })
    if (args) event.args = args
    this._scheduled.splice(ind, 0, event)
  }

  DspObject.prototype._unscheduleTypes = function(types) {
    this._scheduled = _.reject(this._scheduled, function(event) {
      return _.contains(types, event.type)
    })
  }

;return DspObject;})(events.EventEmitter);

module.exports = DspObject

