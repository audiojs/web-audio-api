// EventTarget mixin — shared by DspObject and AudioPort
// Adds on/off/once/emit/removeAllListeners/listenerCount to any EventTarget subclass

export default (Base = EventTarget) => class Emitter extends Base {
  #listeners = []

  on(type, fn) {
    this.#listeners.push({ type, fn })
    this.addEventListener(type, fn)
  }

  off(type, fn) {
    this.#listeners = this.#listeners.filter(l => !(l.type === type && l.fn === fn))
    this.removeEventListener(type, fn)
  }

  once(type, fn) {
    let wrapper = (e) => { fn(e); this.off(type, wrapper) }
    this.on(type, wrapper)
  }

  emit(type, detail) {
    let e = new Event(type)
    if (detail !== undefined) e.detail = detail
    this.dispatchEvent(e)
  }

  listenerCount(type) {
    return this.#listeners.filter(l => l.type === type).length
  }

  removeAllListeners(type) {
    if (type) {
      for (let l of this.#listeners) if (l.type === type) this.removeEventListener(l.type, l.fn)
      this.#listeners = this.#listeners.filter(l => l.type !== type)
    } else {
      for (let l of this.#listeners) this.removeEventListener(l.type, l.fn)
      this.#listeners = []
    }
  }
}
