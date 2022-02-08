class AudioBuffer {
  #sampleRate
  get sampleRate() { return this.#sampleRate }
  #length
  get length() { return this.#length }
  #duration
  get duration() { return this.#duration }
  #numberOfChannels
  get numberOfChannels() { return this.#numberOfChannels }

  constructor(numberOfChannels, length, sampleRate) {
    var ch

    // Just a hack to be able to create a partially initialized AudioBuffer
    if (!arguments.length) return

    // define attrs
    if (!(sampleRate > 0)) throw new Error('invalid sample rate : ' + sampleRate)
    this.#sampleRate = sampleRate
    if (!(length >= 0)) throw new Error('invalid length : ' + length)
    this.#length = length
    this.#duration = length / sampleRate
    if (!(numberOfChannels > 0)) throw new Error('invalid numberOfChannels : ' + numberOfChannels)
    this.#numberOfChannels = numberOfChannels

    //data is stored as a planar sequence
    this._buffer = new Float32Array(this.length * this.numberOfChannels)

    //channels data is cached as subarrays
    this._data = []
    for (ch = 0; ch < numberOfChannels; ch++)
      this._data.push(this._buffer.subarray(ch * this.length, (ch+1) * this.length ))
  }

  getChannelData(channel) {
    if (channel >= this.#numberOfChannels) throw new Error('invalid channel')
    return this._data[channel]
  }

  // FIXME: move to userland
  slice() {
    var sliceArgs = [...arguments]
    var array = this._data.map(chArray => chArray.subarray.apply(chArray, sliceArgs))
    return AudioBuffer.fromArray(array, this.sampleRate)
  }

  // FIXME: move to userland
  concat(other) {
    if (other.sampleRate !== this.sampleRate)
      throw new Error('the 2 AudioBuffers don\'t have the same sampleRate')
    if (other.numberOfChannels !== this.numberOfChannels)
      throw new Error('the 2 AudioBuffers don\'t have the same numberOfChannels')
    var newLength = other.length + this.length,
      newChArray, newArray = this._data.map(function(chArray, ch) {
        newChArray = new Float32Array(newLength)
        newChArray.set(chArray)
        newChArray.set(other._data[ch], chArray.length)
        return newChArray
      })
    return AudioBuffer.fromArray(newArray, this.sampleRate)
  }

  // FIXME: move to userland
  set(other, offset) {
    if (other.sampleRate !== this.sampleRate)
      throw new Error('the 2 AudioBuffers don\'t have the same sampleRate')
    if (other.numberOfChannels !== this.numberOfChannels)
      throw new Error('the 2 AudioBuffers don\'t have the same numberOfChannels')
    this._data.forEach(function(chArray, ch) {
      chArray.set(other.getChannelData(ch), offset)
    })
  }

  // FIXME: move to userland
  static filledWithVal(val, numberOfChannels, length, sampleRate) {
    var audioBuffer = new AudioBuffer(numberOfChannels, length, sampleRate),
      chData, ch, i
    for (ch = 0; ch < numberOfChannels; ch++) {
      chData = audioBuffer._data[ch]
      for (i = 0; i < length; i++) chData[i] = val
    }
    return audioBuffer
  }

  // FIXME: move to userland
  static fromArray(array, sampleRate) {
    var audioBuffer = new AudioBuffer(array.length, array[0].length, sampleRate)
    array.forEach((chArray, ch) => audioBuffer._data[ch].set(chArray))
    return audioBuffer
  }

}

export default AudioBuffer
