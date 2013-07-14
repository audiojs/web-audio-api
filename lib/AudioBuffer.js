var AudioBuffer = module.exports = function(sampleRate, data) {
  var length = data[0].length
  data.forEach(function(array) {
    if(array.length !== length)
      throw new Error('All channels in data must have the same length')
  })
  Object.defineProperty(this, 'sampleRate', {value: sampleRate, writable: false})
  Object.defineProperty(this, 'length', {value: length, writable: false})
  Object.defineProperty(this, 'duration', {value: length / sampleRate, writable: false})
  Object.defineProperty(this, 'numberOfChannels', {value: data.length, writable: false})
  this._data = data
}

AudioBuffer.prototype.getChannelData = function(channel) {
  if (channel >= this.numberOfChannels) throw new Error('invalid channel')
  return this._data[channel]
}

AudioBuffer.zeros = function(sampleRate, channels, length) {
  var data = [], i
  for (i = 0; i < channels; i++) data.push(new Float32Array(length))
  return new AudioBuffer(sampleRate, data)
}