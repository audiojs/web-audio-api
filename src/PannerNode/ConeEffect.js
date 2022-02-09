import * as mathUtils from '../mathUtils.js'
import InvalidStateError from '../InvalidStateError.js'

/**
 * Computes cone effect gain and manages related properties.
 */
class ConeEffect {

  constructor() {
    this._innerAngle = 360
    this._outerAngle = 360
    this._outerGain  = 0
  }

  // Angles in degrees
  get innerAngle() { return this._innerAngle }
  set innerAngle(innerAngle) {
    if (!Number.isFinite(innerAngle)) {
      throw new TypeError('Invalid coneInnerAngle')
    }
    this._innerAngle = (innerAngle - 1) % 360 + 1
  }

  get outerAngle() { return this._outerAngle }
  set outerAngle(outerAngle) {
    if (!Number.isFinite(outerAngle)) {
      throw new TypeError('Invalid coneOuterAngle')
    }
    this._outerAngle = (outerAngle - 1) % 360 + 1
  }

  get outerGain() { return this._outerGain }
  set outerGain(outerGain) {
    if (!Number.isFinite(outerGain)) {
      throw new TypeError('Invalid coneOuterGain')
    }
    if (outerGain < 0 || 1 < outerGain) {
      throw new InvalidStateError('Invalid coneOuterGain')
    }
    this._outerGain = outerGain
  }

  /**
   * Returns scalar gain for the given source/listener positions/orientations
   * @param {FloatPoint3D} sourcePosition
   * @param {FloatPoint3D} sourceOrientation
   * @param {FloatPoint3D} listenerPosition
   * @return {number}
   */
  gain(sourcePosition, sourceOrientation, listenerPosition) {
    if (sourceOrientation.isZero() || ((this._innerAngle === 360.0) && (this._outerAngle === 360.0))) {
      return 1.0 // no cone specified - unity gain
    }

    // Source-listener vector
    const sourceToListener = listenerPosition.sub(sourcePosition) // FloatPoint3D

    // Angle between the source orientation vector and the source-listener vector
    const angle = mathUtils.rad2deg(sourceToListener.angleBetween(sourceOrientation))
    const absAngle = Math.abs(angle) // double

    // Divide by 2.0 here since API is entire angle (not half-angle)
    const absInnerAngle = Math.abs(this._innerAngle) / 2.0
    const absOuterAngle = Math.abs(this._outerAngle) / 2.0
    let gain = 1.0

    if (absAngle <= absInnerAngle) {
      gain = 1.0
    }
    else if (absAngle >= absOuterAngle) {
      gain = this._outerGain
    }
    else {
      const x = (absAngle - absInnerAngle) / (absOuterAngle - absInnerAngle)
      gain = (1.0 - x) + this._outerGain * x
    }

    return gain
  }

}

export default ConeEffect
