/**
 * The abstract class to extend in EqualPowerPanner, HRTFPanner(not implemented).
 */
class Panner {

  /** @abstract */
  pan() {
    throw new Error('Do not call Panner.prototype.pan manually.')
  }

}

module.exports = Panner
