const DistanceModelType = {
  inverse     : 'inverse',
  linear      : 'linear',
  exponential : 'exponential',
}

class DistanceEffect {
  #model = 'inverse'
  #clamped = true
  #refDistance = 1
  #maxDistance = 10000
  #rolloffFactor = 1

  get model() { return this.#model }

  setModel(model, clamped) {
    if (!DistanceModelType[model]) return // WebIDL: silently ignore invalid enum
    this.#model = model
    this.#clamped = clamped
  }

  get refDistance() { return this.#refDistance }
  set refDistance(v) {
    if (!Number.isFinite(v) || v < 0) throw new RangeError('refDistance must be non-negative and finite')
    this.#refDistance = v
  }

  get maxDistance() { return this.#maxDistance }
  set maxDistance(v) {
    if (!Number.isFinite(v) || v <= 0) throw new RangeError('maxDistance must be positive and finite')
    this.#maxDistance = v
  }

  get rolloffFactor() { return this.#rolloffFactor }
  set rolloffFactor(v) {
    if (!Number.isFinite(v) || v < 0) throw new RangeError('rolloffFactor must be non-negative and finite')
    this.#rolloffFactor = v
  }

  gain(distance) {
    distance = Math.min(distance, this.#maxDistance)
    if (this.#clamped) distance = Math.max(distance, this.#refDistance)

    switch (this.#model) {
    case 'linear':
      // Per spec, rolloffFactor clamped to [0, 1] for linear model
      let rolloff = Math.min(Math.max(this.#rolloffFactor, 0), 1)
      return 1 - rolloff * (distance - this.#refDistance) / (this.#maxDistance - this.#refDistance)
    case 'inverse':
      return this.#refDistance / (this.#refDistance + this.#rolloffFactor * (distance - this.#refDistance))
    case 'exponential':
      return Math.pow(distance / this.#refDistance, -this.#rolloffFactor)
    default:
      throw new TypeError('Invalid distance model')
    }
  }
}

export default DistanceEffect
