import Emitter from './Emitter.js'

class DspObject extends Emitter() {
  #context
  get context() { return this.#context }

  constructor(context) {
    super()
    this.#context = context
    this._scheduled = []
  }

  _tick() {
    let event = this._scheduled.shift()
    let eventsSameTime, eventsToExecute = []
    let previousTime

    while (event?.time <= this.context.currentTime) {
      previousTime = event.time
      eventsSameTime = []
      while (event?.time === previousTime) {
        if (eventsSameTime.every(other => event.type !== other.type)) eventsSameTime.push(event)
        event = this._scheduled.shift()
      }
      eventsToExecute.push(...eventsSameTime)
    }
    if (event) this._scheduled.unshift(event)

    while (event = eventsToExecute.pop()) event.func?.()
  }

  _schedule(type, time, func, args) {
    let event = { time, func, type }
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
