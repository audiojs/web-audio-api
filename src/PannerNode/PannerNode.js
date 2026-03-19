import AudioNode from '../AudioNode.js'
import AudioParam from '../AudioParam.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from '../constants.js'
import FloatPoint3D from '../FloatPoint3D.js'
import DistanceEffect from './DistanceEffect.js'
import ConeEffect from './ConeEffect.js'
import * as mathUtils from '../mathUtils.js'
import { DOMErr } from '../errors.js'

const PANNING_MODELS = { equalpower: 'equalpower', HRTF: 'HRTF' }

class PannerNode extends AudioNode {

  #positionX
  #positionY
  #positionZ
  #orientationX
  #orientationY
  #orientationZ
  #panningModel = 'equalpower'

  get positionX() { return this.#positionX }
  get positionY() { return this.#positionY }
  get positionZ() { return this.#positionZ }
  get orientationX() { return this.#orientationX }
  get orientationY() { return this.#orientationY }
  get orientationZ() { return this.#orientationZ }

  constructor(context, options) {
    options = AudioNode._checkOpts(options)
    super(context, 1, 1, 2, 'clamped-max', 'speakers')

    this._listener = context.listener
    this._distanceEffect = new DistanceEffect()
    this._coneEffect = new ConeEffect()
    this._outBuf = new AudioBuffer(2, BLOCK_SIZE, context.sampleRate)

    // Pre-allocate scratch FloatPoint3D instances to avoid per-sample allocations.
    // _s0/_s1: reused as pos/orient in the per-sample loop.
    // _s2.._s6: used inside _calculateAzimuthElevation.
    // _s7: used by ConeEffect.gain() for sourceToListener computation.
    this._s0 = new FloatPoint3D()
    this._s1 = new FloatPoint3D()
    this._s2 = new FloatPoint3D()
    this._s3 = new FloatPoint3D()
    this._s4 = new FloatPoint3D()
    this._s5 = new FloatPoint3D()
    this._s6 = new FloatPoint3D()
    this._s7 = new FloatPoint3D()

    this.#positionX = new AudioParam(this.context, options.positionX ?? 0, 'a')
    this.#positionY = new AudioParam(this.context, options.positionY ?? 0, 'a')
    this.#positionZ = new AudioParam(this.context, options.positionZ ?? 0, 'a')
    this.#orientationX = new AudioParam(this.context, options.orientationX ?? 1, 'a')
    this.#orientationY = new AudioParam(this.context, options.orientationY ?? 0, 'a')
    this.#orientationZ = new AudioParam(this.context, options.orientationZ ?? 0, 'a')

    this._position = new FloatPoint3D(this.#positionX.value, this.#positionY.value, this.#positionZ.value)
    this._orientation = new FloatPoint3D(this.#orientationX.value, this.#orientationY.value, this.#orientationZ.value)

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
      throw DOMErr(`The channelCount provided (${val}) is outside the range [1, 2].`, 'NotSupportedError')
  }

  _validateChannelCountMode(val) {
    if (val === 'max')
      throw DOMErr(`Panner: 'max' is not allowed`, 'NotSupportedError')
  }

  // --- delegation properties ---

  get distanceModel() { return this._distanceEffect.model }
  set distanceModel(val) { this._distanceEffect.setModel(val, true) }

  get panningModel() { return this.#panningModel }
  set panningModel(val) {
    if (!PANNING_MODELS[val]) return // WebIDL: silently ignore invalid enum values
    this.#panningModel = val
  }

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

  // --- 3D setters (legacy spec methods) ---

  setOrientation(x, y, z) {
    if (arguments.length !== 3)
      throw new TypeError(`Failed to execute 'setOrientation' on 'PannerNode': 3 arguments required, but only ${arguments.length} present.`)
    if (!(isFinite(Math.fround(x)) && isFinite(Math.fround(y)) && isFinite(Math.fround(z))))
      throw new TypeError(`Failed to execute 'setOrientation' on 'PannerNode': The provided float value is non-finite.`)
    this.#orientationX.value = x
    this.#orientationY.value = y
    this.#orientationZ.value = z
  }

  setPosition(x, y, z) {
    if (arguments.length !== 3)
      throw new TypeError(`Failed to execute 'setPosition' on 'PannerNode': 3 arguments required, but only ${arguments.length} present.`)
    if (!(isFinite(Math.fround(x)) && isFinite(Math.fround(y)) && isFinite(Math.fround(z))))
      throw new TypeError(`Failed to execute 'setPosition' on 'PannerNode': The provided float value is non-finite.`)
    this.#positionX.value = x
    this.#positionY.value = y
    this.#positionZ.value = z
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

    // Tick all AudioParams to get per-sample automation values (Float32Array)
    let px = this.#positionX._tick()
    let py = this.#positionY._tick()
    let pz = this.#positionZ._tick()
    let ox = this.#orientationX._tick()
    let oy = this.#orientationY._tick()
    let oz = this.#orientationZ._tick()

    // Tick listener params (block-rate)
    let listener = this._listener._tick()
    let listenerPos = listener.position
    let listenerFwd = listener.orientation
    let listenerUp = listener.upVector

    let inBuff = this._inputs[0]._tick()
    let numInputCh = inBuff.numberOfChannels
    let srcL = inBuff.getChannelData(0)
    let srcR = numInputCh > 1 ? inBuff.getChannelData(1) : srcL

    // Per-sample spatial processing.
    // Apply panning first (writes to Float32Array, matching spec precision),
    // then multiply by distance/cone gain.
    // Reuse pre-allocated scratch FloatPoint3D instances to avoid per-sample allocations.
    let pos = this._s0
    let orient = this._s1
    for (let i = 0; i < BLOCK_SIZE; i++) {
      pos.set(px[i], py[i], pz[i])
      orient.set(ox[i], oy[i], oz[i])

      let { azimuth } = this._calculateAzimuthElevation(pos, listenerPos, listenerFwd, listenerUp)

      // Equal-power panning gains
      let { gainL, gainR } = this._equalPowerGains(azimuth, numInputCh)

      // Apply panning (stored in Float32Array, quantizing intermediates to float32)
      if (numInputCh === 1) {
        outL[i] = srcL[i] * gainL
        outR[i] = srcL[i] * gainR
      } else {
        if (azimuth <= 0) {
          outL[i] = srcL[i] + srcR[i] * gainL
          outR[i] = srcR[i] * gainR
        } else {
          outL[i] = srcL[i] * gainL
          outR[i] = srcR[i] + srcL[i] * gainR
        }
      }

      // Distance and cone gain (applied after panning, matching spec ordering)
      let dist = pos.distanceTo(listenerPos)
      let totalGain = Math.fround(this._distanceEffect.gain(dist) * this._coneEffect.gain(pos, orient, listenerPos, this._s7))
      outL[i] *= totalGain
      outR[i] *= totalGain
    }

    // Update cached position/orientation (for external queries)
    this._position.set(px[BLOCK_SIZE - 1], py[BLOCK_SIZE - 1], pz[BLOCK_SIZE - 1])
    this._orientation.set(ox[BLOCK_SIZE - 1], oy[BLOCK_SIZE - 1], oz[BLOCK_SIZE - 1])

    return this._outBuf
  }

  _equalPowerGains(azimuth, numChannels) {
    azimuth = mathUtils.clampTo(azimuth, -180.0, 180.0)

    if (azimuth < -90) azimuth = -180 - azimuth
    else if (azimuth > 90) azimuth = 180 - azimuth

    let panPosition
    if (numChannels === 1) {
      panPosition = (azimuth + 90) / 180
    } else {
      if (azimuth <= 0) panPosition = (azimuth + 90) / 90
      else panPosition = azimuth / 90
    }

    let panRadius = Math.PI / 2 * panPosition
    return { gainL: Math.cos(panRadius), gainR: Math.sin(panRadius) }
  }

  _calculateAzimuthElevation(position, listenerPosition, listenerOrientation, listenerUpVector) {
    // Use pre-allocated scratch objects (_s2.._s6) to avoid per-sample allocations.
    let sourceListener = this._s2.setFrom(position).subFrom(listenerPosition)
    sourceListener.normalize()

    if (sourceListener.isZero()) return { azimuth: 0, elevation: 0 }

    let listenerRight = listenerOrientation.crossInto(listenerUpVector, this._s3)
    listenerRight.normalize()

    let listenerFrontNorm = this._s4.setFrom(listenerOrientation)
    listenerFrontNorm.normalize()

    let up = listenerRight.crossInto(listenerFrontNorm, this._s5)
    let upProjection = sourceListener.dot(up)
    // projectedSource = sourceListener - up * upProjection
    let projectedSource = this._s6.setFrom(up).mulSelf(upProjection)
    projectedSource.set(
      sourceListener.x - projectedSource.x,
      sourceListener.y - projectedSource.y,
      sourceListener.z - projectedSource.z
    )

    // When projectedSource is zero (source directly above/below), azimuth is 0.
    if (projectedSource.isZero()) return { azimuth: 0, elevation: 0 }

    projectedSource.normalize()

    let azimuth = mathUtils.rad2deg(projectedSource.angleBetween(listenerRight))
    azimuth = mathUtils.fixNANs(azimuth)

    if (projectedSource.dot(listenerFrontNorm) < 0.0) azimuth = 360.0 - azimuth
    azimuth = (azimuth >= 0.0 && azimuth <= 270.0) ? 90.0 - azimuth : 450.0 - azimuth

    let elevation = 90 - mathUtils.rad2deg(sourceListener.angleBetween(up))
    elevation = mathUtils.fixNANs(elevation)
    if (elevation > 90.0) elevation = 180.0 - elevation
    else if (elevation < -90.0) elevation = -180.0 - elevation

    return { azimuth, elevation }
  }

}

export default PannerNode
