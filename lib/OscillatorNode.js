var AudioNode = require('./AudioNode'),
  AudioParam = require('./AudioParam'),
  AudioBuffer = require('./AudioBuffer'),
  BLOCK_SIZE = require('./constants').BLOCK_SIZE,
  _ = require('lodash'),
  readOnlyAttr = require('./utils').readOnlyAttr;
require('es6-shim')

var OscillatorTypeToFunc = {
  "sine": Math.sin,
  "square": function(x) {
    if (x == 0 % 2 * Math.PI) {
      return 0
    } else {
      return 1 * Math.abs(Math.sin(x)) * 1 / Math.sin(x)
    }
  },
  "sawtooth": function(x) {
    return -2 * 1 / Math.PI * Math.atan(1 / Math.tan(x / 2))
  },
  "triangle": function(x) {
    return 2 * 1 / Math.PI * Math.asin(Math.sin(x))
  }
}


class OscillatorNode extends AudioNode {

  constructor(context) {
    super(context, 0, 1, undefined, 'max', 'speakers')
    this.type = "sine"
    readOnlyAttr(this, 'frequency', new AudioParam(this.context, 440, 'a'))
    readOnlyAttr(this, 'detune', new AudioParam(this.context, 0, 'a'))
    this._dsp = this._dspZeros;
  }

  set type(value) {
    this.__type = value
    if (this.__type !== 'custom') {
      this.__typefunc = OscillatorTypeToFunc[this.__type]
    } else {
      var u = []

      var f = function(a, b, i, x) {
        return a * Math.sin(i * x) + b * Math.cos(i * x)
      }
      for (var i = 1; i < this.__periodicWave.real.length; i++) {
        u.push(_.curry(f)(this.__periodicWave.real[i], this.__periodicWave.imag[i], i))
      }


      this.__typefunc = function(x) {
        /*
        var u = []

        function f(a, b, i, x) {
          return a * Math.sin(i * x) + b * Math.cos(i * x)
        }
        for (var i = 1; i < this.__periodicWave.real.length; i++) {
          u.push(_.curry(f)(this.__periodicWave.real[i], this.__periodicWave.imag[i], i)(x))
        }
        */
        return u[0](x) + u[1](x);
        /*
        return _.reduce(u, function(sum, num) {
          return sum + num;
        });
        */
      }
    }
  }

  get type() {
    return this.__type
  }

  start(when = 0) {
    if (typeof when === 'undefined') {
      when = 0;
    }
    var cursor = 0,
      phi = 0,
      sampleRate = this.context.sampleRate,
      freqArray, detuneArray, cursorNext, computedArray;

    this._schedule('start', when, () => {
      // Subsequent calls to `start` have no effect
      this.start = () => {};
      this._dsp = () => {
        freqArray = Array.prototype.slice.call(this.frequency._tick().getChannelData(0));
        detuneArray = Array.prototype.slice.call(this.detune._tick().getChannelData(0));
        cursorNext = cursor + BLOCK_SIZE
        var outBuffer = new AudioBuffer(1, BLOCK_SIZE, this.context.sampleRate)
        for (var ch = 0; ch < outBuffer.numberOfChannels; ch++) {
          var outChArray = outBuffer.getChannelData(ch);
          for (var i = 0; i < BLOCK_SIZE; i++) {
            var f = freqArray[i] + Math.pow(2, detuneArray[i] / 1200)
            var w = 2 * Math.PI * f / this.context.sampleRate
            outChArray[i] = this.__typefunc(w * i + phi)
          }
        }
        phi += w * i;
        return outBuffer
      }
    })

  }

  stop(when) {
    this._schedule('stop', when, () => {
      this._dsp = this._dspZeros;
    })
  }

  onended() {}

  _tick() {
    super._tick(arguments);
    return this._dsp();
  }

  _dsp() {}

  _dspZeros() {
    return new AudioBuffer(1, BLOCK_SIZE, this.context.sampleRate);
  }

  setPeriodicWave(periodicWave) {
    this.__periodicWave = periodicWave
    this.type = "custom"
  }

}


module.exports = OscillatorNode
