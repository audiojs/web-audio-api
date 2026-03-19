import * as mathUtils from './mathUtils.js'

/**
 * 3D point class for panner, listener, etc.
 * The original idea is from chromium's Web Audio API implementation.
 https://code.google.com/p/chromium/codesearch#chromium/src/third_party/WebKit/Source/platform/geometry/FloatPoint3D.h
 */
class FloatPoint3D {

  constructor(x, y, z) {
    this.x = x || 0
    this.y = y || 0
    this.z = z || 0
  }

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

  dot(a) {
    return this.x * a.x + this.y * a.y + this.z * a.z
  }

  norm() {
    return Math.sqrt(this.dot(this))
  }

  distanceTo(a) {
    let dx = this.x - a.x, dy = this.y - a.y, dz = this.z - a.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  setFrom(a) {
    this.x = a.x; this.y = a.y; this.z = a.z
    return this
  }

  set(x, y, z) {
    this.x = x; this.y = y; this.z = z
    return this
  }

  subFrom(a) {
    this.x -= a.x; this.y -= a.y; this.z -= a.z
    return this
  }

  crossInto(b, out) {
    out.x = this.y * b.z - this.z * b.y
    out.y = this.z * b.x - this.x * b.z
    out.z = this.x * b.y - this.y * b.x
    return out
  }

  mulSelf(k) {
    this.x *= k; this.y *= k; this.z *= k
    return this
  }

  angleBetween(y) {
    const xNorm = this.norm()
    const yNorm = y.norm()

    if (xNorm && yNorm) {
      const cosAngle = this.dot(y) / (xNorm * yNorm)
      return Math.acos(mathUtils.clampTo(cosAngle, -1.0, 1.0))
    }
    return 0
  }
}

export default FloatPoint3D
