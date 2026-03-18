import Panner from './Panner.js'
import * as mathUtils from '../mathUtils.js'

/**
 * Computes gains for PanningModel "equalpower".
 * Per spec, no smoothing/de-zippering is applied — gains change instantly.
 */
class EqualPowerPanner extends Panner {

  constructor(sampleRate) {
    super()
  }

  reset() {}

  /**
   * Compute output gains from azimuth and elevation,
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

    let panPosition

    if (numberOfInputChannels === 1) { // For mono source case.
      // Pan from left to right with azimuth going from -90 -> +90 degrees.
      panPosition = (azimuth + 90) / 180
    }
    else { // For stereo source case.
      if (azimuth <= 0) { // from -90 -> 0
        panPosition = (azimuth + 90) / 90
      }
      else { // from 0 -> +90
        panPosition = azimuth / 90
      }
    }

    const panRadius = Math.PI / 2 * panPosition
    const gainL = Math.cos(panRadius)
    const gainR = Math.sin(panRadius)

    const n = framesToProcess

    if (numberOfInputChannels === 1) { // For mono source case.
      for (let i = 0; i < n; i++) {
        destinationL[i] = sourceL[i] * gainL
        destinationR[i] = sourceL[i] * gainR
      }
    }
    else { // For stereo source case.
      if (azimuth <= 0) { // from -90 -> 0
        for (let i = 0; i < n; i++) {
          destinationL[i] = sourceL[i] + sourceR[i] * gainL
          destinationR[i] = sourceR[i] * gainR
        }
      }
      else { // from 0 -> +90
        for (let i = 0; i < n; i++) {
          destinationL[i] = sourceL[i] * gainL
          destinationR[i] = sourceR[i] + sourceL[i] * gainR
        }
      }
    }
  }

}

export default EqualPowerPanner
