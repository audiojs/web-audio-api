var FloatPoint3D = require('./FloatPoint3D')

class AudioListener {

  constructor() {
    this._position      = new FloatPoint3D(0, 0, 0)
    this._orientation   = new FloatPoint3D(0, 0, -1)
    this._upVector      = new FloatPoint3D(0, 1, 0)
    this._velocity      = new FloatPoint3D(0, 0, 0)
  }

  /**
   * @param {float} x
   * @param {float} y
   * @param {float} z
   */
  setPosition(x, y, z) {
    this._position = new FloatPoint3D(x, y, z)
  }

  /**
   * @param {float} x
   * @param {float} y
   * @param {float} z
   * @param {float} xUp
   * @param {float} yUp
   * @param {float} zUp
   */
  setOrientation(x, y, z, xUp, yUp, zUp) {
    this._setOrientation(x, y, z)
    this._setUpVector(xUp, yUp, zUp)
  }

  /**
   * @param {float} x
   * @param {float} y
   * @param {float} z
   */
  _setOrientation(x, y, z) {
    this._position = new FloatPoint3D(x, y, z)
  }

  /**
   * @param {float} xUp
   * @param {float} yUp
   * @param {float} zUp
   */
  _setUpVector(xUp, yUp, zUp) {
    this._upVector = new FloatPoint3D(xUp, yUp, zUp)
  }

  get position() { return this._position }
  get velocity() { return this._velocity }
  get upVector() { return this._upVector }
  get orientation() { return this._orientation }

}

module.exports = AudioListener
