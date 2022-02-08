import events from 'events'

class DspObject extends events.EventEmitter {
  #context
  get context() {return this.#context}

  constructor(context) {
    super()
    this.#context = context
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
      }
    if (args) event.args = args

    let ind = this._scheduled.findIndex(e => e.time >= time)
    if (ind < 0) ind = this._scheduled.length
    this._scheduled.splice(ind, 0, event)
  }

  _unscheduleTypes(types) {
    this._scheduled = this._scheduled.filter(event => !types.includes(event.type))
  }

}

export default DspObject
