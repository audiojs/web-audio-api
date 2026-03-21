// Tiny event emitter — extends EventTarget for instanceof conformance,
// but overrides addEventListener/removeEventListener/dispatchEvent with own tracking.
// No Node.js maxListeners warnings, no duplicate tracking, no platform dependency.

export default () => class Emitter extends EventTarget {
  #events = new Map()

  addEventListener(type, fn) {
    if (!fn) return
    let s = this.#events.get(type)
    if (!s) this.#events.set(type, s = new Set())
    s.add(fn)
  }

  removeEventListener(type, fn) {
    this.#events.get(type)?.delete(fn)
  }

  dispatchEvent(event) {
    let s = this.#events.get(event.type)
    if (s) for (let fn of s) fn.call(this, event)
    return true
  }

  on(type, fn) { this.addEventListener(type, fn) }
  off(type, fn) { this.removeEventListener(type, fn) }

  once(type, fn) {
    let w = (e) => { fn(e); this.off(type, w) }
    this.on(type, w)
  }

  emit(type, detail) {
    let e = new Event(type)
    if (detail !== undefined) e.detail = detail
    this.dispatchEvent(e)
  }

  listenerCount(type) { return this.#events.get(type)?.size || 0 }

  removeAllListeners(type) {
    if (type) this.#events.delete(type)
    else this.#events.clear()
  }
}
