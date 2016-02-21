var AudioNode = require('./AudioNode')
  , AudioBuffer = require('./AudioBuffer')
  , BLOCK_SIZE = require('./constants').BLOCK_SIZE
  , FloatPoint3D = require('./FloatPoint3D')
  , DistanceEffect = require('./DistanceEffect')
  , ConeEffect = require('./ConeEffect')
  , mathUtil = require('./mathUtil')

var DistanceModelType = {
  linear      : 'linear',
  inverse     : 'inverse',
  exponential : 'exponential',
}

var PanningModelType = {
  equalpower : true,
  HRTF       : true,
}

class PannerNode extends AudioNode {

  constructor(context) {
    super(context, 1, 1, 2, 'clamped-max', 'speakers')

    /** @private */
    this._listener = context.listener

    /** @type {DistanceModelType} */
    var _distanceModel = 'inverse'
    /** @type {DistanceEffect} */
    this._distanceEffect = new DistanceEffect()
    Object.defineProperty(this, 'distanceModel', {
      get() { return _distanceModel },
      set(val) {
        if (!DistanceModelType[val]) {
          throw new Error('Invalid distanceModel')
        }
        _distanceModel = val
        this._distanceEffect.setModel(val)
      },
    })

    /** @type {float} */
    var _maxDistance = 10000
    Object.defineProperty(this, 'maxDistance', {
      get() { return _maxDistance },
      set(val) {
        if (!Number.isFinite(val)) {
          throw new Error('Invalid maxDistance')
        }
        _maxDistance = val
      },
    })

    /** @type {PanningModelType} */
    var _panningModel = 'equalpower'
    Object.defineProperty(this, 'panningModel', {
      get() { return _panningModel },
      set(val) {
        if (!PanningModelType[val]) {
          throw new Error('Invalid panningModel')
        }
        _panningModel = val
      },
    })

    /** @type {float} */
    var _refDistance = 1
    Object.defineProperty(this, 'refDistance', {
      get() { return _refDistance },
      set(val) {
        if (!Number.isFinite(val)) {
          throw new Error('Invalid refDistance')
        }
        _refDistance = val
      },
    })

    /** @type {float} */
    var _rolloffFactor = 1
    Object.defineProperty(this, 'rolloffFactor', {
      get() { return _rolloffFactor },
      set(val) {
        if (!Number.isFinite(val)) {
          throw new Error('Invalid rolloffFactor')
        }
        _rolloffFactor = val
      },
    })

    /** @type {ConeEffect} */
    this._coneEffect = new ConeEffect()

    /** @type {float} */
    Object.defineProperty(this, 'coneInnerAngle', [
      get() { return this._coneEffect.innerAngle }
      set(val) { this._coneEffect.innerAngle = val }
    ])

    /** @type {float} */
    Object.defineProperty(this, 'coneOuterAngle', [
      get() { return this._coneEffect.outerAngle }
      set(val) { this._coneEffect.outerAngle = val }
    ])

    /** @type {float} */
    Object.defineProperty(this, 'coneOuterGain', [
      get() { return this._coneEffect.outerGain }
      set(val) { this._coneEffect.setOuterGain = val }
    ])

    this._orientation = new FloatPoint3D(1, 0, 0)
    this._position    = new FloatPoint3D(1, 0, 0)
    this._velocity    = new FloatPoint3D(1, 0, 0)
  }

  /**
   * Describes which direction the audio source is pointing in the 3D cartesian coordinate space.
   * Depending on how directional the sound is (controlled by the cone attributes),
   * a sound pointing away from the listener can be very quiet or completely silent.
   * @param {float} x
   * @param {float} y
   * @param {float} z
   * @return {void}
   */
  setOrientation(x, y, z) {
    var args = [].slice.call(arguments);
    if (args.length !== 3) {
      throw new TypeError(`Failed to execute 'setOrientation' on 'PannerNode' 3 arguments required, but only ${args.length} present`)
    }
    if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))) {
      throw new Error('Invalid orientation')
    }
    this._orientation = new FloatPoint3D(x, y, z)
  }

  /**
   * Sets the position of the audio source relative to the listener attribute.
   * A 3D cartesian coordinate system is used.
   * @param {float} x
   * @param {float} y
   * @param {float} z
   * @return {void}
   */
  setPosition(x, y, z) {
    var args = [].slice.call(arguments);
    if (args.length !== 3) {
      throw new TypeError(`Failed to execute 'setPosition' on 'PannerNode' 3 arguments required, but only ${args.length} present`)
    }
    if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))) {
      throw new Error('Invalid position')
    }
    this._position = new FloatPoint3D(x, y, z)
  }

  /**
   * Sets the velocity vector of the audio source.
   * This vector controls both the direction of travel and the speed in 3D space.
   * This velocity relative to the listener's velocity is used to determine
   * how much doppler shift (pitch change) to apply.
   * The units used for this vector is meters / second and is independent
   * of the units used for position and orientation vectors.
   * @param {float} x
   * @param {float} y
   * @param {float} z
   * @return {void}
   */
  setVelocity(x, y, z) {
    var args = [].slice.call(arguments);
    if (args.length !== 3) {
      throw new TypeError(`Failed to execute 'setVelocity' on 'PannerNode' 3 arguments required, but only ${args.length} present`)
    }
    if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))) {
      throw new Error('Invalid velocity')
    }
    this._velocity = new FloatPoint3D(x, y, z)
  }

  /**
   * Calculate azimuth, elevation between panner and listener.
   * @return {azimuth: float, elevation: flaot}
   */
  _calculateAzimuthElevation() {
    let azimuth = 0.0

    // Calculate the source-listener vector
    const listenerPosition = this._listener.position
    const sourceListener   = this._position.sub(listenerPosition)
    sourceListener.normalize()

    // Align axes
    const listenerFront = this._listener.orientation       // FloatPoint3D
    const listenerUp    = this._listener.upVector()        // FloatPoint3D
    const listenerRight = listenerFront.cross(listenerUp)  // FloatPoint3D
    listenerRight.normalize()

    const listenerFrontNorm = listenerFront  // FloatPoint3D
    listenerFrontNorm.normalize()

    const up = listenerRight.cross(listenerFrontNorm)  // FloatPoint3D

    const upProjection = sourceListener.dot(up)  // float

    const projectedSource = sourceListener.sub(upProjection).mul(up)  // FloatPoint3D

    azimuth = mathUtil.rad2deg(projectedSource.angleBetween(listenerRight))
    azimuth = mathUtil.fixNANs(azimuth)  // avoid illegal values

    // Source  in front or behind the listener
    const frontBack = projectedSource.dot(listenerFrontNorm)  // double
    if (frontBack < 0.0) {
      azimuth = 360.0 - azimuth
    }

    // Make azimuth relative to "front" and not "right" listener vector
    if ((azimuth >= 0.0) && (azimuth <= 270.0)) {
      azimuth = 90.0 - azimuth
    }
    else {
      azimuth = 450.0 - azimuth
    }

    // Elevation
    let elevation = 90 - mathUtil.rad2deg(sourceListener.angleBetween(up))  // double
    elevation = mathUtil.fixNANs(elevation) // avoid illegal values

    if (elevation > 90.0) {
      elevation = 180.0 - elevation
    }
    else if (elevation < -90.0) {
      elevation = -180.0 - elevation
    }

    return { azimuth, elevation }
  }

  _calculateDistanceConeGain() {
    const listenerPosition = this._listener.position // FloatPoint3D

    const listenerDistance = this._position.distanceTo(listenerPosition) // double
    const distanceGain     = this._distanceEffect.gain(listenerDistance) // double
    const coneGain         = this._coneEffect.gain(
      this._position, this._orientation, listenerPosition
    ) // double

    return distanceGain * coneGain
  }

  _azimuthElevation() {

  }

  _distanceConeGain() {

  }

  /**
   * @override
   */
  _tick() {
    // copied from GainNode
    var outBuff, inBuff, gainArray, i, ch, inChArray, outChArray
    super._tick(arguments)
    inBuff = this._inputs[0]._tick()
    gainArray = this.gain._tick().getChannelData(0)
    outBuff = new AudioBuffer(inBuff.numberOfChannels, BLOCK_SIZE, this.context.sampleRate)
    for (ch = 0; ch < inBuff.numberOfChannels; ch++) {
      inChArray = inBuff.getChannelData(ch)
      outChArray = outBuff.getChannelData(ch)
      for (i = 0; i < BLOCK_SIZE; i++) {
        outChArray[i] = inChArray[i] * gainArray[i]
      }
    }
    return outBuff
  }

}

module.exports = PannerNode
