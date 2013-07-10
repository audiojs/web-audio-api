var fs = require('fs')
  , _ = require('underscore')
  , PassThrough = require('stream').PassThrough
  , ffmpeg = require('fluent-ffmpeg')
	, basenodes = require('./AudioNode')
	, utils = require('./utils')


module.exports = basenodes.SourceNode.extend({

  init: function(filename, opts) {
    var self = this
    this.filename = filename
    this._decoder = null          // function for decoding PCM bytes
    this._frame = 0               // frames read
    this._maxFrame = Infinity     // frame corresponding with the end of the sound
    this._converterStream = null
    this._fileStream = null

    this.opts = _.defaults(opts || {}, {
      loop: false,

      // Start position in the file in seconds
      start: undefined,

      // End position in the file in seconds
      end: undefined,

      // This block size is not guaranteed if for the example EOF is reached
      // it is just to configure how much data is read at once for the decoding.
      blockSize: 1024
    })

    this._initStreams(function(err) {
      if (err) self.emit('error', err)
      else {
        self._initOutput()
        self.emit('ready')
      }
    })
  },

  _initStreams: function(done) {
    var self = this
    this._frame = 0

    // Create the streams
    this._converterStream = new PassThrough()
    this._fileStream = new ffmpeg({source: this.filename, nolog: false})
      .toFormat('s16le')

    // Handling 'start' / 'end' options
    if (this.opts.start)
      this._fileStream = this._fileStream.setStartTime(this.opts.start)

    // If the file hasn't been opened before, we get its format
    if (!this.format)
      this._fileStream = this._fileStream.onCodecData(function(infos) { self._onFormat(infos) })

    // Connect streams
    try {
      this._fileStream.writeToStream(self._converterStream, function(retCode, err) {
        if (retCode !== 0) done(err)
        else done()
      })
    } catch(err) {
      // To allow the caller to add a handler event to catch this
      process.nextTick(function() { done(err) })
    }
  },

  _onFormat: function(infos) {
    var sampleRate = parseInt(infos.audio_details[1], 10)
      , bitDepth = 16 // we enforce this with the ffmpeg options
      , channels = {mono: 1, stereo: 2}[infos.audio_details[2]]
    if (this.opts.end)
      this._maxFrame = Math.round((this.opts.end - (this.opts.start || 0)) * sampleRate)
    this.channels = channels
    this.format = {
      sampleRate: sampleRate,
      bitDepth: bitDepth,
      channels: channels
    }
    this._decoder = utils.PCMDecoder(this.format)
  },

  _onEnd: function(next) {
    // If loop, we reinit te streams, and get a new block when that's done
    if (this.opts.loop) {
      this._initStreams(function(err) {
        if (err) this.emit('error', err)
        next()
      })
    // else we just close the node
    } else {
      this.close()
      next()
    }
  },

  getBlock: function(done) {
    var self = this
      , data = this._converterStream.read(this.opts.blockSize) || this._converterStream.read()

    // If the data read from the stream is null there's 2 possibilities:
    // either this is the end of the stream, or we need to request more data
    if (data === null) {
      var onEnd = function() {
          self._converterStream.removeListener('readable', onReadable)
          self._onEnd(function() { self.getBlock(done) })
        }
        , onReadable = function() {
          self._converterStream.removeListener('end', onEnd)
          self.getBlock(done)
        }
        this._converterStream.once('end', onEnd)
        this._converterStream.once('readable', onReadable)
    } else {
      var block = self._decoder(data)
        , blockSize = block[0].length
        , missingFrames = this._maxFrame - this._frame
      if (missingFrames > blockSize) {
        this._frame += block[0].length
        done(null, block)
      } else {
        block = block.map(function(chArray) { return chArray.slice(0, missingFrames) })
        self._onEnd(function() { done(null, block) })
      }
    }
  }

})