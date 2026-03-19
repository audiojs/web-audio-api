const PanningModelType = {
  equalpower : 'equalpower',
  HRTF       : 'HRTF',
}

/**
 * Validates and stores panningModel enum value.
 */
class PannerProvider {

  /**
   * @param {AudioContext} context
   */
  constructor(context) {
    this._panningModel = 'equalpower'
  }

  get panningModel() { return this._panningModel }
  set panningModel(panningModel) {
    if (!PanningModelType[panningModel]) return // WebIDL: silently ignore invalid enum values
    this._panningModel = panningModel
  }

}

export default PannerProvider
