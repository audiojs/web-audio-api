var AudioBuffer = module.exports = function(numberOfChannels, length, sampleRate) {
  var ch
  this._data = []
  for (ch = 0; ch < numberOfChannels; ch++)
    this._data.push(new Float32Array(length))

  if (!(sampleRate > 0)) throw new Error('invalid sample rate : ' + sampleRate)
  Object.defineProperty(this, 'sampleRate', {value: sampleRate, writable: false})
  if (!(length > 0)) throw new Error('invalid length : ' + length)
  Object.defineProperty(this, 'length', {value: length, writable: false})
  Object.defineProperty(this, 'duration', {value: length / sampleRate, writable: false})
  if (!(numberOfChannels > 0)) throw new Error('invalid numberOfChannels : ' + numberOfChannels)
  Object.defineProperty(this, 'numberOfChannels', {value: numberOfChannels, writable: false})
}

AudioBuffer.prototype.getChannelData = function(channel) {
  if (channel >= this.numberOfChannels) throw new Error('invalid channel')
  return this._data[channel]
}

AudioBuffer.filledWithVal = function(val, numberOfChannels, length, sampleRate) {
  var audioBuffer = new AudioBuffer(numberOfChannels, length, sampleRate)
    , chData, ch, i
  for (ch = 0; ch < numberOfChannels; ch++) {
    chData = audioBuffer.getChannelData(ch)
    for (i = 0; i < length; i++) chData[i] = val
  }
  return audioBuffer
}