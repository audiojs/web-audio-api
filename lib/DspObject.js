var _ = require('underscore')
  , events = require('events')

class DspObject extends events.EventEmitter {

  constructor(context) {
    super()
    this.context = context
    this._scheduled = []
  }

  _tick() {
    this._frame++
    var event = this._scheduled.shift()
      , eventsSameTime, eventsToExecute = []
      , previousTime
    
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
      event.func && event.func()
    })
  }

  _schedule(type, time, func, args) {
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

  _unscheduleTypes(types) {
    this._scheduled = _.reject(this._scheduled, function(event) {
      return _.contains(types, event.type)
    })
  }

}

module.exports = DspObject
