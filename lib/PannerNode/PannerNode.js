var _ = require('underscore')
  , AudioNode = require('../AudioNode')
  , AudioBuffer = require('../AudioBuffer')
  , BLOCK_SIZE = require('../constants').BLOCK_SIZE
  , FloatPoint3D = require('../FloatPoint3D')
  , DistanceEffect = require('./DistanceEffect')
  , ConeEffect = require('./ConeEffect')
  , PannerProvider = require('./PannerProvider')
  , mathUtils = require('../mathUtils')
  , NotSupportedError = require('../NotSupportedError')

var ChannelCountMode = _.object(['max', 'clamped-max', 'explicit'].map(x => [x, x]))

class PannerNode extends AudioNode {

  constructor(context) {
    super(context, 1, 1, 2, 'clamped-max', 'speakers')

    /**
     * @override
     */
    var channelCount = 2
    Object.defineProperty(this, 'channelCount', {
      get() { return channelCount },
      set(val) {
        if (val !== 1 && val !== 2) {
          throw new NotSupportedError(`The channelCount provided (${val}) is outside the range [1, 2].`)
        }
        channelCount = val
      },
    })

    /**
     * @override
     */
    var channelCountMode = 'clamped-max'
    Object.defineProperty(this, 'channelCountMode', {
      get() { return channelCountMode },
      set(val) {
        if (!ChannelCountMode[val]) {
          throw new TypeError(`Invalid value for channelCountMode : ${val}`)
        }
        if (val === ChannelCountMode.max) {
          throw new NotSupportedError(`Panner: 'max' is not allowed`)
        }
        channelCountMode = val
      },
    })

    /** @private */
    this._listener = context.listener

    /** @type {DistanceEffect} */
    this._distanceEffect = new DistanceEffect()

    /** @type {DistanceModelType} */
    Object.defineProperty(this, 'distanceModel', {
      get() { return this._distanceEffect.model },
      set(val) {
        this._distanceEffect.setModel(val, true)
      },
    })

    /** @type {PannerProvider} */
    this._pannerProvider = new PannerProvider(context)

    /** @type {PanningModelType} */
    Object.defineProperty(this, 'panningModel', {
      get() { return this._pannerProvider.panningModel },
      set(val) { this._pannerProvider.panningModel = val },
    })

    /** @type {float} */
    Object.defineProperty(this, 'refDistance', {
      get() { return this._distanceEffect.refDistance },
      set(val) { this._distanceEffect.refDistance = val },
    })

    /** @type {float} */
    Object.defineProperty(this, 'maxDistance', {
      get() { return this._distanceEffect._maxDistance },
      set(val) { this._distanceEffect.maxDistance = val },
    })

    /** @type {float} */
    Object.defineProperty(this, 'rolloffFactor', {
      get() { return this._distanceEffect.rolloffFactor },
      set(val) { this._distanceEffect.rolloffFactor = val },
    })

    /** @type {ConeEffect} */
    this._coneEffect = new ConeEffect()

    /** @type {float} */
    Object.defineProperty(this, 'coneInnerAngle', {
      get() { return this._coneEffect.innerAngle },
      set(val) { this._coneEffect.innerAngle = val },
    })

    /** @type {float} */
    Object.defineProperty(this, 'coneOuterAngle', {
      get() { return this._coneEffect.outerAngle },
      set(val) { this._coneEffect.outerAngle = val },
    })

    /** @type {float} */
    Object.defineProperty(this, 'coneOuterGain', {
      get() { return this._coneEffect.outerGain },
      set(val) { this._coneEffect.outerGain = val },
    })

    this._orientation = new FloatPoint3D(1, 0, 0)
    this._position    = new FloatPoint3D(1, 0, 0)
    this._velocity    = new FloatPoint3D(1, 0, 0)

    // Remember gain in last `_tick` to dezipper.
    // -1 means it is the first time `_tick` run.
    this._lastGain = -1
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
      throw new TypeError(`Failed to execute 'setOrientation' on 'PannerNode' 3 arguments required, but only ${args.length} present.`)
    }
    if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))) {
      throw new TypeError(`Failed to execute 'setOrientation' on 'PannerNode': The provided float value is non-finite.`)
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
      throw new TypeError(`Failed to execute 'setPosition' on 'PannerNode' 3 arguments required, but only ${args.length} present.`)
    }
    if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))) {
      throw new TypeError(`Failed to execute 'setPosition' on 'PannerNode': The provided float value is non-finite.`)
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
      throw new TypeError(`Failed to execute 'setVelocity' on 'PannerNode' 3 arguments required, but only ${args.length} present.`)
    }
    if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))) {
      throw new TypeError(`Failed to execute 'setVelocity' on 'PannerNode': The provided float value is non-finite.`)
    }
    this._velocity = new FloatPoint3D(x, y, z)
  }

  /**
   * Calculate azimuth, elevation between panner and listener.
   * @return {azimuth: float, elevation: float}
   */
  _calculateAzimuthElevation() {
    let azimuth = 0.0

    // Calculate the source-listener vector
    const listenerPosition = this._listener.position
    const sourceListener   = this._position.sub(listenerPosition)
    sourceListener.normalize()

    if (sourceListener.isZero()) {
      return { azimuth : 0, elevation : 0 }
    }

    // Align axes
    const listenerFront = this._listener.orientation       // FloatPoint3D
    const listenerUp    = this._listener.upVector          // FloatPoint3D
    const listenerRight = listenerFront.cross(listenerUp)  // FloatPoint3D
    listenerRight.normalize()

    const listenerFrontNorm = listenerFront  // FloatPoint3D
    listenerFrontNorm.normalize()

    const up = listenerRight.cross(listenerFrontNorm)  // FloatPoint3D

    const upProjection = sourceListener.dot(up)  // float

    const projectedSource = sourceListener.sub(up.mul(upProjection)) // FloatPoint3D

    azimuth = mathUtils.rad2deg(projectedSource.angleBetween(listenerRight))
    azimuth = mathUtils.fixNANs(azimuth)  // avoid illegal values

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
    let elevation = 90 - mathUtils.rad2deg(sourceListener.angleBetween(up))  // double
    elevation = mathUtils.fixNANs(elevation) // avoid illegal values

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

  /**
   * Method for cache.
   */
  _azimuthElevation() {
    return this._calculateAzimuthElevation()
  }

  /**
   * Method for cache.
   */
  _distanceConeGain() {
    return this._calculateDistanceConeGain()
  }

  /**
   * Reset panner's gain cache for dezipper
   */
  _resetPanner() {
    this._pannerProvider.panner.reset()
  }

  /**
   * @override
   * @return {AudioBuffer}
   */
  _tick() {
    super._tick(arguments)

    // AudioBus* destination = output(0).bus();
    var outBuff = new AudioBuffer(2, BLOCK_SIZE, this.context.sampleRate)
    const outL = outBuff.getChannelData(0)
    const outR = outBuff.getChannelData(1)

    if (!this.panningModel) {
      for (let i = 0; i < BLOCK_SIZE; i++) {
        outL[i] = outR[i] = 0
      }
      return outBuff
    }

    var inBuff = this._inputs[0]._tick() // AudioBuffer

    // Apply the panning effect.
    const { azimuth, elevation } = this._azimuthElevation()

    this._pannerProvider.panner.pan(azimuth, elevation, inBuff, outBuff, BLOCK_SIZE)

    // Get the distance and cone gain.
    const totalGain = this._distanceConeGain() // float

    // Snap to desired gain at the beginning.
    if (this._lastGain === -1.0) {
      this._lastGain = totalGain
    }

    // Apply gain in-place with de-zippering.
    // outBuff.copyWithGainFrom(outBuff, this._lastGain, totalGain)
    for (let i = 0; i < BLOCK_SIZE; i++) {
      outL[i] *= totalGain
      outR[i] *= totalGain
    }

    return outBuff
  }

}

module.exports = PannerNode
