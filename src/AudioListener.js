import FloatPoint3D from './FloatPoint3D.js'

class AudioListener {

  constructor() {
    this._position    = new FloatPoint3D(0, 0, 0)
    this._orientation = new FloatPoint3D(0, 0, -1)
    this._upVector    = new FloatPoint3D(0, 1, 0)
    this._velocity    = new FloatPoint3D(0, 0, 0)
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  setPosition(x, y, z) {
    this._position = new FloatPoint3D(x, y, z)
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} xUp
   * @param {number} yUp
   * @param {number} zUp
   */
  setOrientation(x, y, z, xUp, yUp, zUp) {
    this._setOrientation(x, y, z)
    this._setUpVector(xUp, yUp, zUp)
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  _setOrientation(x, y, z) {
    this._orientation = new FloatPoint3D(x, y, z)
  }

  /**
   * @param {number} xUp
   * @param {number} yUp
   * @param {number} zUp
   */
  _setUpVector(xUp, yUp, zUp) {
    this._upVector = new FloatPoint3D(xUp, yUp, zUp)
  }

  get position() { return this._position }
  get velocity() { return this._velocity }
  get upVector() { return this._upVector }
  get orientation() { return this._orientation }

}

export default AudioListener
