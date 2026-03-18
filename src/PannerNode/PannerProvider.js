import EqualPowerPanner from './EqualPowerPanner.js'

const PanningModelType = {
  equalpower : 'equalpower',
  HRTF       : 'HRTF',
}

/**
 * Provides pannignModel accessors and Panner instances.
 */
class PannerProvider {

  /**
   * @param {AudioContext} context
   */
  constructor(context) {
    this._context = context
    this._panningModel = 'equalpower'
    this._panner = this.create(this._panningModel, this._context.sampleRate)
  }

  get panningModel() { return this._panningModel }
  set panningModel(panningModel) {
    if (!PanningModelType[panningModel]) return // WebIDL: silently ignore invalid enum values
    this._panningModel = panningModel
    this._panner = this.create(panningModel)
  }

  get panner() { return this._panner }

  /**
   * @param {PanningModelType} model
   * @param {number} sampleRate
   * @return {Panner}
   */
  create(model, sampleRate) {
    switch (model) {
    case PanningModelType.equalpower:
      return new EqualPowerPanner(sampleRate)
    case PanningModelType.HRTF:
      // HRTF not implemented; fall back to equal-power
      return new EqualPowerPanner(sampleRate)
    default:
      throw new TypeError('Invalid panner model')
    }
  }

}

export default PannerProvider
