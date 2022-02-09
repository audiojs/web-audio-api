import events from 'events'

class DspObject extends events.EventEmitter {
  #context
  get context() {return this.#context}

  constructor(context) {
    super()
    this.#context = context
    this._scheduled = []
  }

  // load corresponding wasm dsp processor
  _loadDSP(name) {
    const memory = new WebAssembly.Memory({initial:1})

    const instance = new WebAssembly.Instance(
      new WebAssembly.Module(
        fs.readFileSync(`./dsp/${name}.wasm`)
      ),
      {js:{memory}}
    )

    const input = new Float32Array(memory.buffer)
  }

  _tick() {
    var event = this._scheduled.shift()
      , eventsSameTime, eventsToExecute = []
      , previousTime

    // Gather all events that need to be executed at this tick
    while (event?.time <= this.context.currentTime) {
      previousTime = event.time
      eventsSameTime = []
      // Gather all the events with same time
      while (event?.time === previousTime) {
        // Add the event only if there isn't already events with same type
        if (eventsSameTime.every((other) => event.type !== other.type)) eventsSameTime.push(event)
        event = this._scheduled.shift()
      }
      eventsToExecute.push(...eventsSameTime)
    }
    if (event) this._scheduled.unshift(event)

    // And execute
    while (event = eventsToExecute.pop()) event.func?.()
  }

  _schedule(type, time, func, args) {
    // FIXME: this can be simple array
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
