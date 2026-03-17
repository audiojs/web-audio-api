import FloatPoint3D from './FloatPoint3D.js'
import AudioParam from './AudioParam.js'

class AudioListener {

  #positionX
  #positionY
  #positionZ
  #forwardX
  #forwardY
  #forwardZ
  #upX
  #upY
  #upZ

  get positionX() { return this.#positionX }
  get positionY() { return this.#positionY }
  get positionZ() { return this.#positionZ }
  get forwardX() { return this.#forwardX }
  get forwardY() { return this.#forwardY }
  get forwardZ() { return this.#forwardZ }
  get upX() { return this.#upX }
  get upY() { return this.#upY }
  get upZ() { return this.#upZ }

  constructor(context) {
    this.#positionX = new AudioParam(context, 0, 'a')
    this.#positionY = new AudioParam(context, 0, 'a')
    this.#positionZ = new AudioParam(context, 0, 'a')
    this.#forwardX = new AudioParam(context, 0, 'a')
    this.#forwardY = new AudioParam(context, 0, 'a')
    this.#forwardZ = new AudioParam(context, -1, 'a')
    this.#upX = new AudioParam(context, 0, 'a')
    this.#upY = new AudioParam(context, 1, 'a')
    this.#upZ = new AudioParam(context, 0, 'a')

    this._velocity = new FloatPoint3D(0, 0, 0)
  }

  get position() {
    return new FloatPoint3D(this.#positionX.value, this.#positionY.value, this.#positionZ.value)
  }

  get orientation() {
    return new FloatPoint3D(this.#forwardX.value, this.#forwardY.value, this.#forwardZ.value)
  }

  get upVector() {
    return new FloatPoint3D(this.#upX.value, this.#upY.value, this.#upZ.value)
  }

  get velocity() { return this._velocity }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  setPosition(x, y, z) {
    this.#positionX.value = x
    this.#positionY.value = y
    this.#positionZ.value = z
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
    this.#forwardX.value = x
    this.#forwardY.value = y
    this.#forwardZ.value = z
    this.#upX.value = xUp
    this.#upY.value = yUp
    this.#upZ.value = zUp
  }

}

export default AudioListener
