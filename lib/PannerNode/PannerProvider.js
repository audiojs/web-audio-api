var EqualPowerPanner = require('./EqualPowerPanner')

const PanningModel = {
  equalpower : 'equalpower',
  HRTF       : 'HRTF',
}

class PannerProvider {

  constructor(context) {
    this._context = context
    this._panningModel = 'equalpower'
    this._panner = this.create(this._panningModel, this._context.sampleRate)
  }

  get panningModel() { return this._panningModel }
  set panningModel(panningModel) {
    if (!PanningModel[panningModel]) {
      throw new TypeError('Invalid panningModel')
    }
    this._panningModel = panningModel
    this._panner = this.create(panningModel)
  }

  get panner() { return this._panner }

  /**
   * @param {PanningModel} model
   * @param {float} sampleRate
   * @return {Panner}
   */
  create(model, sampleRate) {
    switch (model) {
    case PanningModel.equalpower:
      return new EqualPowerPanner(sampleRate)
    case PanningModel.HRTF:
      throw new TypeError('HRTF panner is not implemented')
    default:
      throw new TypeError('Invalid panner model')
    }
  }

}

module.exports = PannerProvider
