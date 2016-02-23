var mathUtil = require('../mathUtil')

class InvalidStateError extends Error {}

class ConeEffect {

  constructor() {
    this._innerAngle = 360
    this._outerAngle = 360
    this._outerGain  = 0
  }

  /**
   * Returns scalar gain for the given source/listener positions/orientations
   * @param {FloatPoint3D} sourcePosition
   * @param {FloatPoint3D} sourceOrientation
   * @param {FloatPoint3D} listenerPosition
   * @return {double}
   */
  gain(sourcePosition, sourceOrientation, listenerPosition) {
    if (sourceOrientation.isZero() || ((this._innerAngle === 360.0) && (this._outerAngle === 360.0))) {
      return 1.0 // no cone specified - unity gain
    }

    // Source-listener vector
    const sourceToListener = listenerPosition.sub(sourcePosition) // FloatPoint3D

    // Angle between the source orientation vector and the source-listener vector
    const angle = mathUtil.rad2deg(sourceToListener.angleBetween(sourceOrientation)) // double
    const absAngle = Math.abs(angle) // double

    // Divide by 2.0 here since API is entire angle (not half-angle)
    const absInnerAngle = Math.abs(this._innerAngle) / 2.0 // double
    const absOuterAngle = Math.abs(this._outerAngle) / 2.0 // double
    let gain = 1.0 // double

    if (absAngle <= absInnerAngle) {
      // No attenuation
      gain = 1.0
    }
    else if (absAngle >= absOuterAngle) {
      // Max attenuation
      gain = this._outerGain
    }
    else {
      // Between inner and outer cones
      // inner -> outer, x goes from 0 -> 1
      const x = (absAngle - absInnerAngle) / (absOuterAngle - absInnerAngle) // double
      gain = (1.0 - x) + this._outerGain * x
    }

    return gain
  }

  // Angles in degrees
  get innerAngle() { return this._innerAngle }
  set innerAngle(innerAngle) {
    if (!Number.isFinite(innerAngle)) {
      throw new Error('Invalid coneInnerAngle')
    }
    this._innerAngle = innerAngle % 360
  }

  get outerAngle() { return this._outerAngle }
  set outerAngle(outerAngle) {
    if (!Number.isFinite(outerAngle)) {
      throw new Error('Invalid coneOuterAngle')
    }
    this._outerAngle = outerAngle % 360
  }

  get outerGain() { return this._outerGain }
  set outerGain(outerGain) {
    if (!Number.isFinite(outerGain)) {
      throw new Error('Invalid coneOuterGain')
    }
    if (outerGain < 0 || 1 < outerGain) {
      throw new InvalidStateError('Invalid coneOuterGain')
    }
    this._outerGain = outerGain
  }

}

module.exports = ConeEffect
