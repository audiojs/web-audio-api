import * as mathUtils from '../mathUtils.js'
import { DOMErr } from '../errors.js'

class ConeEffect {
  #innerAngle = 360
  #outerAngle = 360
  #outerGain = 0

  get innerAngle() { return this.#innerAngle }
  set innerAngle(v) {
    if (!Number.isFinite(v)) throw new TypeError('Invalid coneInnerAngle')
    this.#innerAngle = v
  }

  get outerAngle() { return this.#outerAngle }
  set outerAngle(v) {
    if (!Number.isFinite(v)) throw new TypeError('Invalid coneOuterAngle')
    this.#outerAngle = v
  }

  get outerGain() { return this.#outerGain }
  set outerGain(v) {
    if (!Number.isFinite(v)) throw new TypeError('Invalid coneOuterGain')
    if (v < 0 || v > 1) throw DOMErr('Invalid coneOuterGain', 'InvalidStateError')
    this.#outerGain = v
  }

  gain(sourcePosition, sourceOrientation, listenerPosition) {
    if (sourceOrientation.isZero() || (this.#innerAngle === 360 && this.#outerAngle === 360))
      return 1 // no cone — unity gain

    let sourceToListener = listenerPosition.sub(sourcePosition)
    let absAngle = Math.abs(mathUtils.rad2deg(sourceToListener.angleBetween(sourceOrientation)))
    let absInner = Math.abs(this.#innerAngle) / 2
    let absOuter = Math.abs(this.#outerAngle) / 2

    if (absAngle <= absInner) return 1
    if (absAngle >= absOuter) return this.#outerGain
    let x = (absAngle - absInner) / (absOuter - absInner)
    return (1 - x) + this.#outerGain * x
  }
}

export default ConeEffect
