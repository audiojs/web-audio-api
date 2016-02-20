const DistanceModel = {
  inverse     : 'inverse',
  linear      : 'linear',
  exponential : 'exponential',
}

class DistanceEffect {

  constructor() {
    this._model         = DistanceModel.Inverse
    this._isClamped     = true
    this._refDistance   = 1.0
    this._maxDistance   = 10000.0
    this._rolloffFactor = 1.0
  }

  /**
   * @param {DistanceModel} model
   * @param {boolean} clampled
   * @return {void}
   */
  setModel(model, clamped) {
    this._model     = model
    this._isClamped = clamped
  }

  setRefDistance(refDistance) { this._refDistance = refDistance }
  setMaxDistance(maxDistance) { this._maxDistance = maxDistance }
  setRolloffFactor(rolloffFactor) { this._rolloffFactor = rolloffFactor }

  refDistance() { return this._refDistance }
  maxDistance() { return this._maxDistance }
  rolloffFactor() { return this._rolloffFactor }

  /**
   * @param {double}
   * @return {double}
   */
  gain(distance) {
    // don't go beyond maximum distance
    distance = Math.min(distance, this._maxDistance)

    // if clamped, don't get closer than reference distance
    if (this._isClamped) {
      distance = Math.max(distance, this._refDistance)
    }

    switch (this._model) {
    case DistanceModel.linear:
      return this.linearGain(distance)
    case DistanceModel.inverse:
      return this.inverseGain(distance)
    case DistanceModel.exponential:
      return this.exponentialGain(distance)
    default:
      throw new TypeError('')
    }
  }

  /**
   * @param {double}
   * @return {double}
   */
  linearGain(distance) {
    return (1.0 - this._rolloffFactor * (distance - this._refDistance) / (this._maxDistance - this._refDistance))
  }

  /**
   * @param {double}
   * @return {double}
   */
  inverseGain(distance) {
    return this._refDistance / (this._refDistance + this._rolloffFactor * (distance - this._refDistance))
  }

  /**
   * @param {double}
   * @return {double}
   */
  exponentialGain(distance) {
    return Math.pow(distance / this._refDistance, -this._rolloffFactor)
  }

}

DistanceEffect.Model = DistanceModel

module.exports = DistanceEffect
