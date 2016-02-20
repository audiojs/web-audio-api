var AudioNode = require('./AudioNode')
  , AudioBuffer = require('./AudioBuffer')
  , BLOCK_SIZE = require('./constants').BLOCK_SIZE

var DistanceModelType = {
  linear      : true,
  inverse     : true,
  exponential : true,
}

var PanningModelType = {
  equalpower : true,
  HRTF       : true,
}

class InvalidStateError extends Error {}

class PannerNode extends AudioNode {

  constructor(context) {
    super(context, 1, 1, 2, 'clamped-max', 'speakers')

    /** @type {float} */
    var _coneInnerAngle = 360
    Object.defineProperty(this, 'coneInnerAngle', {
      get() { return _coneInnerAngle },
      set(val) {
        if (!Number.isFinite(val)) {
          throw new Error('Invalid coneInnerAngle')
        }
        _coneInnerAngle = val % 360
      },
    })

    /** @type {float} */
    var _coneOuterAngle = 360
    Object.defineProperty(this, 'coneOuterAngle', {
      get() { return _coneOuterAngle },
      set(val) {
        if (!Number.isFinite(val)) {
          throw new Error('Invalid coneOuterAngle')
        }
        _coneOuterAngle = val % 360
      },
    })

    /** @type {float} */
    var _coneOuterGain = 0
    Object.defineProperty(this, 'coneOuterGain', {
      get() { return _coneOuterGain },
      set(val) {
        if (!Number.isFinite(val)) {
          throw new Error('Invalid coneOuterGain')
        }
        if (val < 0 || 1 < val) {
          throw new InvalidStateError('Invalid coneOuterGain')
        }
        _coneOuterGain = val
      },
    })

    /** @type {DistanceModelType} */
    var _distanceModel = 'inverse'
    Object.defineProperty(this, 'distanceModel', {
      get() { return _distanceModel },
      set(val) {
        if (!DistanceModelType[val]) {
          throw new Error('Invalid distanceModel')
        }
        _distanceModel = val
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

    this._orientation = [1, 0, 0]
    this._position    = [1, 0, 0]
    this._velocity    = [1, 0, 0]
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
    if (!args.length !== 3) {
      throw new TypeError(`Failed to execute 'setOrientation' on 'PannerNode' 3 arguments required, but only ${args.length} present`)
    }
    if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))) {
      throw new Error('Invalid orientation')
    }
    this._orientation = args
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
    if (!args.length !== 3) {
      throw new TypeError(`Failed to execute 'setPosition' on 'PannerNode' 3 arguments required, but only ${args.length} present`)
    }
    if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))) {
      throw new Error('Invalid position')
    }
    this._position = args
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
    if (!args.length !== 3) {
      throw new TypeError(`Failed to execute 'setVelocity' on 'PannerNode' 3 arguments required, but only ${args.length} present`)
    }
    if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))) {
      throw new Error('Invalid velocity')
    }
    this._velocity = args
  }

  _calculateAzimuthElevation() {

  }

  _calculateDistanceConeGain() {

  }

  _calculateDopplerRate() {

  }

  _azimuthElevation() {

  }

  _distanceConeGain() {

  }

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
