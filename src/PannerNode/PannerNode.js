import AudioNode from '../AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from '../constants.js'
import FloatPoint3D from '../FloatPoint3D.js'
import DistanceEffect from './DistanceEffect.js'
import ConeEffect from './ConeEffect.js'
import PannerProvider from './PannerProvider.js'
import * as mathUtils from '../mathUtils.js'
import { NotSupportedError } from '../errors.js'


class PannerNode extends AudioNode {

  constructor(context, options) {
    options = AudioNode._checkOpts(options)
    super(context, 1, 1, 2, 'clamped-max', 'speakers')

    this._listener = context.listener
    this._distanceEffect = new DistanceEffect()
    this._pannerProvider = new PannerProvider(context)
    this._coneEffect = new ConeEffect()
    this._orientation = new FloatPoint3D(1, 0, 0)
    this._position = new FloatPoint3D(1, 0, 0)
    this._velocity = new FloatPoint3D(1, 0, 0)
    this._lastGain = -1
    this._outBuf = new AudioBuffer(2, BLOCK_SIZE, context.sampleRate)
    if (options.panningModel !== undefined) this.panningModel = options.panningModel
    if (options.distanceModel !== undefined) this.distanceModel = options.distanceModel
    if (options.refDistance !== undefined) this.refDistance = options.refDistance
    if (options.maxDistance !== undefined) this.maxDistance = options.maxDistance
    if (options.rolloffFactor !== undefined) this.rolloffFactor = options.rolloffFactor
    if (options.coneInnerAngle !== undefined) this.coneInnerAngle = options.coneInnerAngle
    if (options.coneOuterAngle !== undefined) this.coneOuterAngle = options.coneOuterAngle
    if (options.coneOuterGain !== undefined) this.coneOuterGain = options.coneOuterGain
    this._applyOpts(options)
  }

  // --- validation hooks (override AudioNode) ---

  _validateChannelCount(val) {
    if (val !== 1 && val !== 2)
      throw new NotSupportedError(`The channelCount provided (${val}) is outside the range [1, 2].`)
  }

  _validateChannelCountMode(val) {
    if (val === 'max')
      throw new NotSupportedError(`Panner: 'max' is not allowed`)
  }

  // --- delegation properties ---

  get distanceModel() { return this._distanceEffect.model }
  set distanceModel(val) { this._distanceEffect.setModel(val, true) }

  get panningModel() { return this._pannerProvider.panningModel }
  set panningModel(val) { this._pannerProvider.panningModel = val }

  get refDistance() { return this._distanceEffect.refDistance }
  set refDistance(val) { this._distanceEffect.refDistance = val }

  get maxDistance() { return this._distanceEffect.maxDistance }
  set maxDistance(val) { this._distanceEffect.maxDistance = val }

  get rolloffFactor() { return this._distanceEffect.rolloffFactor }
  set rolloffFactor(val) { this._distanceEffect.rolloffFactor = val }

  get coneInnerAngle() { return this._coneEffect.innerAngle }
  set coneInnerAngle(val) { this._coneEffect.innerAngle = val }

  get coneOuterAngle() { return this._coneEffect.outerAngle }
  set coneOuterAngle(val) { this._coneEffect.outerAngle = val }

  get coneOuterGain() { return this._coneEffect.outerGain }
  set coneOuterGain(val) { this._coneEffect.outerGain = val }

  // --- 3D setters ---

  setOrientation(x, y, z) {
    if (arguments.length !== 3)
      throw new TypeError(`Failed to execute 'setOrientation' on 'PannerNode': 3 arguments required, but only ${arguments.length} present.`)
    if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)))
      throw new TypeError(`Failed to execute 'setOrientation' on 'PannerNode': The provided float value is non-finite.`)
    this._orientation = new FloatPoint3D(x, y, z)
  }

  setPosition(x, y, z) {
    if (arguments.length !== 3)
      throw new TypeError(`Failed to execute 'setPosition' on 'PannerNode': 3 arguments required, but only ${arguments.length} present.`)
    if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)))
      throw new TypeError(`Failed to execute 'setPosition' on 'PannerNode': The provided float value is non-finite.`)
    this._position = new FloatPoint3D(x, y, z)
  }

  setVelocity(x, y, z) {
    if (arguments.length !== 3)
      throw new TypeError(`Failed to execute 'setVelocity' on 'PannerNode': 3 arguments required, but only ${arguments.length} present.`)
    if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)))
      throw new TypeError(`Failed to execute 'setVelocity' on 'PannerNode': The provided float value is non-finite.`)
    this._velocity = new FloatPoint3D(x, y, z)
  }

  // --- DSP ---

  _tick() {
    super._tick()

    let outL = this._outBuf.getChannelData(0)
    let outR = this._outBuf.getChannelData(1)

    if (!this.panningModel) {
      outL.fill(0)
      outR.fill(0)
      return this._outBuf
    }

    outL.fill(0)
    outR.fill(0)

    let inBuff = this._inputs[0]._tick()
    let { azimuth, elevation } = this._calculateAzimuthElevation()

    this._pannerProvider.panner.pan(azimuth, elevation, inBuff, this._outBuf, BLOCK_SIZE)

    let totalGain = this._calculateDistanceConeGain()
    if (this._lastGain === -1.0) this._lastGain = totalGain

    for (let i = 0; i < BLOCK_SIZE; i++) {
      outL[i] *= totalGain
      outR[i] *= totalGain
    }

    return this._outBuf
  }

  _calculateAzimuthElevation() {
    let azimuth = 0.0

    let listenerPosition = this._listener.position
    let sourceListener = this._position.sub(listenerPosition)
    sourceListener.normalize()

    if (sourceListener.isZero()) return { azimuth: 0, elevation: 0 }

    let listenerFront = this._listener.orientation
    let listenerUp = this._listener.upVector
    let listenerRight = listenerFront.cross(listenerUp)
    listenerRight.normalize()

    let listenerFrontNorm = listenerFront
    listenerFrontNorm.normalize()

    let up = listenerRight.cross(listenerFrontNorm)
    let upProjection = sourceListener.dot(up)
    let projectedSource = sourceListener.sub(up.mul(upProjection))

    azimuth = mathUtils.rad2deg(projectedSource.angleBetween(listenerRight))
    azimuth = mathUtils.fixNANs(azimuth)

    if (projectedSource.dot(listenerFrontNorm) < 0.0) azimuth = 360.0 - azimuth
    azimuth = (azimuth >= 0.0 && azimuth <= 270.0) ? 90.0 - azimuth : 450.0 - azimuth

    let elevation = 90 - mathUtils.rad2deg(sourceListener.angleBetween(up))
    elevation = mathUtils.fixNANs(elevation)
    if (elevation > 90.0) elevation = 180.0 - elevation
    else if (elevation < -90.0) elevation = -180.0 - elevation

    return { azimuth, elevation }
  }

  _calculateDistanceConeGain() {
    let listenerPosition = this._listener.position
    let listenerDistance = this._position.distanceTo(listenerPosition)
    return this._distanceEffect.gain(listenerDistance) * this._coneEffect.gain(this._position, this._orientation, listenerPosition)
  }

}

export default PannerNode
