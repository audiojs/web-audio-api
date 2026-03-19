import * as mathUtils from './mathUtils.js'

/**
 * 3D point class for panner, listener, etc.
 * The original idea is from chromium's Web Audio API implementation.
 https://code.google.com/p/chromium/codesearch#chromium/src/third_party/WebKit/Source/platform/geometry/FloatPoint3D.h
 */
class FloatPoint3D {

  /**
   * @param {number} [x=0]
   * @param {number} [y=0]
   * @param {number} [z=0]
   */
  constructor(x, y, z) {
    this.x = x || 0
    this.y = y || 0
    this.z = z || 0
  }

  /**
   * @return {boolean}
   */
  isZero() {
    return !this.x && !this.y && !this.z
  }

  normalize() {
    const tempNorm = this.norm()
    if (tempNorm) {
      this.x /= tempNorm
      this.y /= tempNorm
      this.z /= tempNorm
    }
  }

  /**
   * @param {FloatPoint3D} a
   */
  dot(a) {
    return this.x * a.x + this.y * a.y + this.z * a.z
  }

  /**
   * Compute the cross product for given point, and return it as a new FloatPoint3D.
   * @param {FloatPoint3D} point
   * @return {FloatPoint3D}
   */
  cross(point) {
    const x = this.y * point.z - this.z * point.y
    const y = this.z * point.x - this.x * point.z
    const z = this.x * point.y - this.y * point.x
    return new FloatPoint3D(x, y, z)
  }

  /**
   * @return {number}
   */
  normSquared() { return this.dot(this) }

  /**
   * @return {number}
   */
  norm() { return Math.sqrt(this.normSquared()) }

  /**
   * @param {FloatPoint3D} a
   * @return {number}
   */
  distanceTo(a) {
    return this.sub(a).norm()
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

  /**
   * @param {FloatPoint3D} a
   */
  sub(a) {
    return new FloatPoint3D(
      this.x - a.x,
      this.y - a.y,
      this.z - a.z
    )
  }

  /**
   * @param {FloatPoint3D} a
   * @return {FloatPoint3D} - this * a
   */
  mul(k) {
    return new FloatPoint3D(k * this.x, k * this.y, k * this.z)
  }

  /**
   * Copy values from another point into this one (mutating).
   * @param {FloatPoint3D} a
   * @return {FloatPoint3D} this
   */
  setFrom(a) {
    this.x = a.x; this.y = a.y; this.z = a.z
    return this
  }

  /**
   * Set x, y, z values directly (mutating).
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @return {FloatPoint3D} this
   */
  set(x, y, z) {
    this.x = x; this.y = y; this.z = z
    return this
  }

  /**
   * Subtract another point in-place (mutating).
   * @param {FloatPoint3D} a
   * @return {FloatPoint3D} this
   */
  subFrom(a) {
    this.x -= a.x; this.y -= a.y; this.z -= a.z
    return this
  }

  /**
   * Compute cross product of this x b, writing result into out (mutating out).
   * @param {FloatPoint3D} b
   * @param {FloatPoint3D} out
   * @return {FloatPoint3D} out
   */
  crossInto(b, out) {
    out.x = this.y * b.z - this.z * b.y
    out.y = this.z * b.x - this.x * b.z
    out.z = this.x * b.y - this.y * b.x
    return out
  }

  /**
   * Scale this point in-place by scalar k (mutating).
   * @param {number} k
   * @return {FloatPoint3D} this
   */
  mulSelf(k) {
    this.x *= k; this.y *= k; this.z *= k
    return this
  }

  /**
   * @param {FloatPoint3D} y
   * @return {number} - angle as radius.
   */
  angleBetween(y) {
    const xNorm = this.norm()
    const yNorm = y.norm()

    if (xNorm && yNorm) {
      const cosAngle = this.dot(y) / (xNorm * yNorm)
      return Math.acos(mathUtils.clampTo(cosAngle, -1.0, 1.0))
    }
    return 0
  }

  /**
   * @return {Array<number>}
   */
  toArray() {
    return [this.x, this.y, this.z]
  }
}

export default FloatPoint3D
