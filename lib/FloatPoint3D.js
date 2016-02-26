var mathUtils = require('./mathUtils')

class FloatPoint3D {

  constructor(x, y, z) {
    if (arguments[0] instanceof FloatPoint3D) {
      const p = arguments[0]
      this.x = p.x
      this.y = p.y
      this.z = p.z
    }
    else {
      this.x = x || 0
      this.y = y || 0
      this.z = z || 0
    }
  }

  set(x, y, z) {
    this.x = x
    this.y = y
    this.z = z
  }

  move(dx, dy, dz) {
    this.x += dx
    this.y += dy
    this.z += dz
  }

  scale(sx, sy, sz) {
    this.x *= sx
    this.y *= sy
    this.z *= sz
  }

  isZero() {
    return !this.x && !this.y && !this.z
  }

  normalize() {
    const tempLength = this.length()
    if (tempLength) {
      this.x /= tempLength
      this.y /= tempLength
      this.z /= tempLength
    }
  }

  /**
   * @param {FloatPoint3D} a
   */
  dot(a) {
    return this.x * a.x + this.y * a.y + this.z * a.z
  }

  /**
   * Sets this FloatPoint3D to the cross product of the passed two.
   * It is safe for "this" to be the same as either or both of the
   * arguments.
   * @param {FloatPoint3D} a
   * @param {FloatPoint3D} b
   * @return {void}
   */
  setCross(a, b) {
    const x = a.y * b.z - a.z * b.y
    const y = a.z * b.x - a.x * b.z
    const z = a.x * b.y - a.y * b.x
    this.x = x
    this.y = y
    this.z = z
  }

  /**
   * Convenience function returning "this cross point" as a
   * stack-allocated result.
   * @param {FloatPoint3D} point
   * @return {FloatPoint3D}
   */
  cross(point) {
    const result = new FloatPoint3D()
    result.setCross(this, point)
    return result
  }

  /**
   * @return {float}
   */
  lengthSquared() { return this.dot(this) }

  /**
   * @return {float}
   */
  length() { return Math.sqrt(this.lengthSquared()) }

  /**
   * @param {FloatPoint3D} a
   * @return {float}
   */
  distanceTo(a) {
    return this.sub(a).length()
  }

  /**
   * @param {FloatPoint3D} a
   */
  add(a) {
    return new FloatPoint3D(
      this.x + a.x,
      this.y + a.y,
      this.z + a.z
    )
  }

  sub(a) {
    return new FloatPoint3D(
      this.x - a.x,
      this.y - a.y,
      this.z - a.z
    )
  }

  equals(a) {
    return this.x === a.x && this.y === a.y  && this.z === a.z
  }

  mul(k) {
    return new FloatPoint3D(k * this.x, k * this.y, k * this.z)
  }

  /**
   * @param {FloatPoint3D} y
   * @return {float}
   */
  angleBetween(y) {
    let xLength = this.length() // float
    let yLength = y.length() // float

    if (xLength && yLength) {
      let cosAngle = this.dot(y) / (xLength * yLength) // float
      return Math.acos(mathUtils.clampTo(cosAngle, -1.0, 1.0))
    }
    return 0
}

}

module.exports = FloatPoint3D
