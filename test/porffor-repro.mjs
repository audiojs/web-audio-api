// Porffor 0.61.13: invalid Wasm ("expected 2 elements on the stack for branch").
// Fixed in alpha 4 (a415d19): prints "ok", as Node does.
// https://github.com/CanadaHonk/porffor/issues/380
class Emitter {
  #events = new Map()
  removeEventListener(type, fn) {
    this.#events.get(type)?.delete(fn)
  }
}
new Emitter().removeEventListener('change', () => {})
console.log('ok')
