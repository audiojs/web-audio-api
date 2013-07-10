var _ = require('underscore')
  , async = require('async')
  , basenodes = require('./AudioNode')
  , utils = require('./utils')
  , Speaker = require('speaker');

module.exports = basenodes.SinkNode.extend({

  init: function(opts) {
    var self = this
    this.opts = _.defaults(opts || {}, {
      // Size of blocks read from the input
      blockSize: 1024
    })
    this.format = {
      channels: 2,          // 2 channels
      bitDepth: 16,         // 16-bit samples
      sampleRate: 44100     // 44,100 Hz sample rate
    }
    this._speaker = new Speaker(this.format)
    this._encoder = utils.PCMEncoder(this.format)
  },

  _onConnected: function() {
    var self = this
    async.whilst(
      function() { return true },
      function(next) {
        self.input.read(self.opts.blockSize, function(err, block) {
          if (err) next(err)
          else {
            if (self._speaker.write(self._encoder(block))) next()
            else self._speaker.once('drain', next)
          }
        })
      },
      function(err) {
        self.emit('error', err)
      }
    )
  }

})