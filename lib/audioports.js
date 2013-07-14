var _ = require('underscore')
  , inherits = require('util').inherits
  , EventEmitter = require('events').EventEmitter
  , utils = require('./utils')

var AudioPort = function(node, id) {
  this.node = node
  this.id = id
  this.init()
}
inherits(AudioPort, EventEmitter)

_.extend(AudioPort.prototype, {

  init: function() {},

  // Connects two ports together
  connect: function(other) { throw new Error('not implemented') },

  // Disconnects two ports
  disconnect: function(other) { throw new Error('not implemented') },

  // Generic function for connecting the calling AudioPort
  // with `otherPort`. Returns true if a connection was indeed established
  _genericConnect: function(allConn, otherPort) {
    if (allConn.indexOf(otherPort) !== -1) return false
    allConn.push(otherPort)
    otherPort.connect(this)
    this.emit('connection', otherPort)
    return true
  },

  // Generic function for disconnecting the calling AudioPort
  // from `otherPort`. Returns true if a disconnection was indeed made
  _genericDisconnect: function(allConn, otherPort) {
    var connInd = allConn.indexOf(otherPort)
    if (connInd === -1) return false
    allConn.splice(connInd, 1)
    otherPort.disconnect(this)
    this.emit('disconnection', otherPort)
    return true
  }

})

var AudioInput = module.exports.AudioInput = function() {
  AudioPort.apply(this, arguments)

  // All AudioOuputs connected to this
  this.sources = []

  Object.defineProperty(this, 'computedNumberOfChannels', {
    get: function() {
      var countMode = this.node.channelCountMode
        , channelCount = this.node.channelCount

      if (!this.sources.length)
        throw new Error('no connection, cannot compute channel number')

      if (countMode === 'max' || countMode === 'clamped-max') {
        var maxChannels = _.chain(this.sources)
          .pluck('computedNumberOfChannels')
          .max().value()
        if (countMode === 'max') return maxChannels
        else return Math.min(maxChannels, channelCount)
      } else if (countMode === 'explicit') return channelCount
      // this shouldn't happen
      else throw new Error('invalid channelCountMode')
    }
  })
}
inherits(AudioInput, AudioPort)

_.extend(AudioInput.prototype, {

  connect: function(source) {
    this._genericConnect(this.sources, source)
  },

  disconnect: function(source) {
    this._genericDisconnect(this.sources, source)
  }

})

var AudioOutput = module.exports.AudioOutput = function() {
  AudioPort.apply(this, arguments)

  // All AudioOutputs this is connected to
  this.sinks = []

  Object.defineProperty(this, 'computedNumberOfChannels', {
    get: function() {
      return this.node.channelCount
    }
  })
}
inherits(AudioOutput, AudioPort)

_.extend(AudioOutput.prototype, {

  init: function() {
    this.sinks = []
  },

  connect: function(sink) {
    this._genericConnect(this.sinks, sink)
  },

  disconnect: function(sink) {
    this._genericDisconnect(this.sinks, sink)
  }

})