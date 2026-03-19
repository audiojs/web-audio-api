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

  #context
  constructor(context) {
    this.#context = context
    this._cachedTime = -1
    this._cached = null
    this.#positionX = new AudioParam(context, 0, 'a')
    this.#positionY = new AudioParam(context, 0, 'a')
    this.#positionZ = new AudioParam(context, 0, 'a')
    this.#forwardX = new AudioParam(context, 0, 'a')
    this.#forwardY = new AudioParam(context, 0, 'a')
    this.#forwardZ = new AudioParam(context, -1, 'a')
    this.#upX = new AudioParam(context, 0, 'a')
    this.#upY = new AudioParam(context, 1, 'a')
    this.#upZ = new AudioParam(context, 0, 'a')

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

  _tick() {
    // Cache per render quantum — multiple panners share the same listener
    let t = this.#context.currentTime
    if (this._cachedTime === t) return this._cached
    this._cachedTime = t
    let px = this.#positionX._tick()
    let py = this.#positionY._tick()
    let pz = this.#positionZ._tick()
    let fx = this.#forwardX._tick()
    let fy = this.#forwardY._tick()
    let fz = this.#forwardZ._tick()
    let ux = this.#upX._tick()
    let uy = this.#upY._tick()
    let uz = this.#upZ._tick()
    return this._cached = {
      position: new FloatPoint3D(px[0], py[0], pz[0]),
      orientation: new FloatPoint3D(fx[0], fy[0], fz[0]),
      upVector: new FloatPoint3D(ux[0], uy[0], uz[0])
    }
  }

  setPosition(x, y, z) {
    if (!(isFinite(Math.fround(x)) && isFinite(Math.fround(y)) && isFinite(Math.fround(z))))
      throw new TypeError('The provided float value is non-finite.')
    this.#positionX.value = x
    this.#positionY.value = y
    this.#positionZ.value = z
  }

  setOrientation(x, y, z, xUp, yUp, zUp) {
    if (!(isFinite(Math.fround(x)) && isFinite(Math.fround(y)) && isFinite(Math.fround(z))
       && isFinite(Math.fround(xUp)) && isFinite(Math.fround(yUp)) && isFinite(Math.fround(zUp))))
      throw new TypeError('The provided float value is non-finite.')
    this.#forwardX.value = x
    this.#forwardY.value = y
    this.#forwardZ.value = z
    this.#upX.value = xUp
    this.#upY.value = yUp
    this.#upZ.value = zUp
  }

}

export default AudioListener
