import Panner from './Panner.js'
import * as mathUtils from '../mathUtils.js'

// Use a 50ms smoothing / de-zippering time-constant.
const SmoothingTimeConstant = 0.050

/**
 * @param {number} timeConstant
 * @param {number} sampleRate
 * @return {number}
 */
const discreteTimeConstantForSampleRate = (timeConstant, sampleRate) => {
  return 1 - Math.exp(-1 / (sampleRate * timeConstant))
}

/**
 * Computes gains for PanningModel "equalpower".
 * Many codes are from chromium's Web Audio API implementation.
 https://code.google.com/p/chromium/codesearch#chromium/src/third_party/WebKit/Source/platform/geometry/FloatPoint3D.h
 */
class EqualPowerPanner extends Panner {

  /**
   * @param {number} sampleRate
   */
  constructor(sampleRate) {
    super()
    this._isFirstRender = true
    this._gainL = 0
    this._gainR = 0
    this._smoothingConstant = discreteTimeConstantForSampleRate(SmoothingTimeConstant, sampleRate)
  }

  reset() {
    this._isFirstRender = true
  }

  /**
   * Compute output gains from azimuth and elevaion,
   * then apply them to inputBus and save to outputBus.
   * @param {number} azimuth
   * @param {number} elevation
   * @param {AudioBuffer} inputBus
   * @param {AudioBuffer} outputBus
   * @param {number} framesToProcess
   */
  pan(azimuth, elevation, inputBus, outputBus, framesToProcess) {
    const isInputSafe = inputBus && (inputBus.numberOfChannels === 1 || inputBus.numberOfChannels === 2) && framesToProcess <= inputBus.length
    if (!isInputSafe) { return }

    const numberOfInputChannels = inputBus.numberOfChannels

    const isOutputSafe = outputBus && outputBus.numberOfChannels === 2 && framesToProcess <= outputBus.length
    if (!isOutputSafe) { return }

    const sourceL = inputBus.getChannelData(0)
    const sourceR = numberOfInputChannels > 1 ? inputBus.getChannelData(1) : sourceL
    const destinationL = outputBus.getChannelData(0)
    const destinationR = outputBus.getChannelData(1)

    if (!sourceL || !sourceR || !destinationL || !destinationR) {
      return
    }

    // Clamp azimuth to allowed range of -180 -> +180.
    azimuth = mathUtils.clampTo(azimuth, -180.0, 180.0)

    // Alias the azimuth ranges behind us to in front of us:
    // -90 -> -180 to -90 -> 0 and 90 -> 180 to 90 -> 0
    if (azimuth < -90) {
      azimuth = -180 - azimuth
    }
    else if (azimuth > 90) {
      azimuth = 180 - azimuth
    }

    let desiredPanPosition

    if (numberOfInputChannels === 1) { // For mono source case.
      // Pan smoothly from left to right with azimuth going from -90 -> +90 degrees.
      desiredPanPosition = (azimuth + 90) / 180
    }
    else { // For stereo source case.
      if (azimuth <= 0) { // from -90 -> 0
        // sourceL -> destL and "equal-power pan" sourceR as in mono case
        // by transforming the "azimuth" value from -90 -> 0 degrees into the range -90 -> +90.
        desiredPanPosition = (azimuth + 90) / 90
      }
      else { // from 0 -> +90
        // sourceR -> destR and "equal-power pan" sourceL as in mono case
        // by transforming the "azimuth" value from 0 -> +90 degrees into the range -90 -> +90.
        desiredPanPosition = azimuth / 90
      }
    }

    const desiredPanRadius = Math.PI / 2 * desiredPanPosition
    const desiredGainL = Math.cos(desiredPanRadius)
    const desiredGainR = Math.sin(desiredPanRadius)

    // Don't de-zipper on first render call.
    if (this._isFirstRender) {
      this._isFirstRender = false
      this._gainL = desiredGainL
      this._gainR = desiredGainR
    }

    // Cache in local variables.
    let gainL = this._gainL
    let gainR = this._gainR

    // Get local copy of smoothing constant.
    const SmoothingConstant = this._smoothingConstant

    const n = framesToProcess

    if (numberOfInputChannels === 1) { // For mono source case.
      for (let i = 0; i < n; i++) {
        const inputL = sourceL[i]
        gainL += (desiredGainL - gainL) * SmoothingConstant
        gainR += (desiredGainR - gainR) * SmoothingConstant
        destinationL[i] = inputL * gainL
        destinationR[i] = inputL * gainR
      }
    }
    else { // For stereo source case.
      if (azimuth <= 0) { // from -90 -> 0
        for (let i = 0; i < n; i++) {
          const inputL = sourceL[i]
          const inputR = sourceR[i]
          gainL += (desiredGainL - gainL) * SmoothingConstant
          gainR += (desiredGainR - gainR) * SmoothingConstant
          destinationL[i] = inputL + inputR * gainL
          destinationR[i] = inputR * gainR
        }
      }
      else { // from 0 -> +90
        for (let i = 0; i < n; i++) {
          const inputL = sourceL[i]
          const inputR = sourceR[i]
          gainL += (desiredGainL - gainL) * SmoothingConstant
          gainR += (desiredGainR - gainR) * SmoothingConstant
          destinationL[i] = inputL * gainL
          destinationR[i] = inputR + inputL * gainR
        }
      }
    }

    this._gainL = gainL
    this._gainR = gainR
  }

}

export default EqualPowerPanner
