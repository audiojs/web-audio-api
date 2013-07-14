var AudioParam = require('../lib/AudioParam')

module.exports.AudioParam = AudioParam
if (typeof window !== undefined) {
  window.AudioParam = AudioParam
}