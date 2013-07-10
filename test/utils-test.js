var _ = require('underscore')
  , fs = require('fs')
  , assert = require('assert')
  , utils = require('../lib/utils')


describe('utils', function() {

  describe('chainExtend', function() {

    A = function() {}
    A.extend = utils.chainExtend
    A.prototype.blo = 456
    A.prototype.bli = 987
    A.prototype.func = function() { return 'blabla' }

    var B = A.extend({ 'bla': 113, 'bli': 654 })
      , C = B.extend({ 'bla': 112 })
      , b = new B()
      , c = new C()

    it('should work with instanceof', function() {
      assert.ok(b instanceof B)
      assert.ok(b instanceof A)
    })

    it('should work with inherited parameters', function() {
      assert.equal(b.bla, 113)
      assert.equal(b.bli, 654)
      assert.equal(b.blo, 456)

      assert.equal(c.bla, 112)
      assert.equal(c.bli, 654)
      assert.equal(c.blo, 456)
    })

  })
  
  describe('PCMDecoder', function() {
    
    var round = function(array, dec) {
      dec = dec || 3
      return array.map(function(chArray) {
        return chArray.map(function(val) {
          return Math.round(val * Math.pow(10, dec)) / Math.pow(10, dec)
        })
      })
    }
    
    it('should decode 16-bits mono', function(done) {
      fs.readFile(__dirname + '/sounds/steps-mono-16b-44khz.wav', function(err, data) {
        if (err) throw err
        var buffers = _.range(21).map(function(i) {
          return data.slice(1000 + (4410 * 2) * i, 1000 + (4410 * 2) * i + (2*5))
        })
        var decode = utils.PCMDecoder({bitDepth: 16, channels: 1})

        assert.deepEqual(round(decode(buffers[0])), [[-1, -1, -1, -1, -1]])
        assert.deepEqual(round(decode(buffers[1])), [[-0.9, -0.9, -0.9, -0.9, -0.9]])
        assert.deepEqual(round(decode(buffers[2])), [[-0.8, -0.8, -0.8, -0.8, -0.8]])
        assert.deepEqual(round(decode(buffers[3])), [[-0.7, -0.7, -0.7, -0.7, -0.7]])
        assert.deepEqual(round(decode(buffers[4])), [[-0.6, -0.6, -0.6, -0.6, -0.6]])
        assert.deepEqual(round(decode(buffers[5])), [[-0.5, -0.5, -0.5, -0.5, -0.5]])
        assert.deepEqual(round(decode(buffers[6])), [[-0.4, -0.4, -0.4, -0.4, -0.4]])
        assert.deepEqual(round(decode(buffers[7])), [[-0.3, -0.3, -0.3, -0.3, -0.3]])
        assert.deepEqual(round(decode(buffers[8])), [[-0.2, -0.2, -0.2, -0.2, -0.2]])
        assert.deepEqual(round(decode(buffers[9])), [[-0.1, -0.1, -0.1, -0.1, -0.1]])
        assert.deepEqual(round(decode(buffers[10])), [[0, 0, 0, 0, 0]])
        assert.deepEqual(round(decode(buffers[11])), [[0.1, 0.1, 0.1, 0.1, 0.1]])
        assert.deepEqual(round(decode(buffers[12])), [[0.2, 0.2, 0.2, 0.2, 0.2]])
        assert.deepEqual(round(decode(buffers[13])), [[0.3, 0.3, 0.3, 0.3, 0.3]])
        assert.deepEqual(round(decode(buffers[14])), [[0.4, 0.4, 0.4, 0.4, 0.4]])
        assert.deepEqual(round(decode(buffers[15])), [[0.5, 0.5, 0.5, 0.5, 0.5]])
        assert.deepEqual(round(decode(buffers[16])), [[0.6, 0.6, 0.6, 0.6, 0.6]])
        assert.deepEqual(round(decode(buffers[17])), [[0.7, 0.7, 0.7, 0.7, 0.7]])
        assert.deepEqual(round(decode(buffers[18])), [[0.8, 0.8, 0.8, 0.8, 0.8]])
        assert.deepEqual(round(decode(buffers[19])), [[0.9, 0.9, 0.9, 0.9, 0.9]])
        assert.deepEqual(round(decode(buffers[20])), [[1, 1, 1, 1, 1]])
        done()
      })
    })
    
    it('should decode 16-bits stereo', function(done) {
      fs.readFile(__dirname + '/sounds/steps-stereo-16b-44khz.wav', function(err, data) {
        if (err) throw err
        var buffers = _.range(21).map(function(i) {
          return data.slice(1000 + (4410 * 4) * i, 1000 + (4410 * 4) * i + (4*2))
        })
        var decode = utils.PCMDecoder({bitDepth: 16, channels: 2})

        assert.deepEqual(round(decode(buffers[0])), [[-1, -1], [1, 1]])
        assert.deepEqual(round(decode(buffers[1])), [[-0.9, -0.9], [0.9, 0.9]])
        assert.deepEqual(round(decode(buffers[2])), [[-0.8, -0.8], [0.8, 0.8]])
        assert.deepEqual(round(decode(buffers[3])), [[-0.7, -0.7], [0.7, 0.7]])
        assert.deepEqual(round(decode(buffers[4])), [[-0.6, -0.6], [0.6, 0.6]])
        assert.deepEqual(round(decode(buffers[5])), [[-0.5, -0.5], [0.5, 0.5]])
        assert.deepEqual(round(decode(buffers[6])), [[-0.4, -0.4], [0.4, 0.4]])
        assert.deepEqual(round(decode(buffers[7])), [[-0.3, -0.3], [0.3, 0.3]])
        assert.deepEqual(round(decode(buffers[8])), [[-0.2, -0.2], [0.2, 0.2]])
        assert.deepEqual(round(decode(buffers[9])), [[-0.1, -0.1], [0.1, 0.1]])
        assert.deepEqual(round(decode(buffers[10])), [[0, 0], [0, 0]])
        assert.deepEqual(round(decode(buffers[11])), [[0.1, 0.1], [-0.1, -0.1]])
        assert.deepEqual(round(decode(buffers[12])), [[0.2, 0.2], [-0.2, -0.2]])
        assert.deepEqual(round(decode(buffers[13])), [[0.3, 0.3], [-0.3, -0.3]])
        assert.deepEqual(round(decode(buffers[14])), [[0.4, 0.4], [-0.4, -0.4]])
        assert.deepEqual(round(decode(buffers[15])), [[0.5, 0.5], [-0.5, -0.5]])
        assert.deepEqual(round(decode(buffers[16])), [[0.6, 0.6], [-0.6, -0.6]])
        assert.deepEqual(round(decode(buffers[17])), [[0.7, 0.7], [-0.7, -0.7]])
        assert.deepEqual(round(decode(buffers[18])), [[0.8, 0.8], [-0.8, -0.8]])
        assert.deepEqual(round(decode(buffers[19])), [[0.9, 0.9], [-0.9, -0.9]])
        assert.deepEqual(round(decode(buffers[20])), [[1, 1], [-1, -1]])
        done()
      })
    })

  })

  describe('PCMEncoder', function() {
    
    var approxEqual = function(val1, val2) {
      if (Math.abs(val1 - val2) <= 5) assert.ok(true)
      else assert.equal(val1, val2)
    }
    
    it('should encode to 16-bits mono', function(done) {
      fs.readFile(__dirname + '/sounds/noise32values-mono-16b-44khz.raw', function(err, data) {
        if (err) throw err
        var encode = utils.PCMEncoder({bitDepth: 16, channels: 1})
          , array = [[0.48, 0.12, 0.52, -0.04, 0.1, 0.44, -0.62, 0.42, 0.8,
                      -1, -0.84, 0.76, -0.18, 0.66, 0.14, -0.02, -0.62, -0.26,
                      -0.26, -0.88, -0.36, -0.46, 0.52, -0.38, -0.4, -0.16, 0.18,
                      -0.06, 0.12, 0.28, -0.46, -0.18]]
          , encoded = encode(array)
        assert.equal(encoded.length, data.length)
        assert.equal(encoded.length, 32 * 2)
        _.range(32).forEach(function(i) {
          approxEqual(encoded.readInt16LE(i * 2), data.readInt16LE(i * 2))
        })
        done()
      })
    })

    it('should encode to 16-bits stereo', function(done) {
      fs.readFile(__dirname + '/sounds/noise32values-stereo-16b-44khz.raw', function(err, data) {
        if (err) throw err
        var encode = utils.PCMEncoder({bitDepth: 16, channels: 2})
          , array = [[0.48, 0.12, 0.52, -0.04, 0.1, 0.44, -0.62, 0.42, 0.8, -1,
                      -0.84, 0.76, -0.18, 0.66, 0.14, -0.02, -0.62, -0.26, -0.26, -0.88,
                      -0.36, -0.46, 0.52, -0.38, -0.4, -0.16, 0.18, -0.06, 0.12, 0.28,
                      -0.46, -0.18],
                     [0.84, 0.32, -0.8, 0.46, -0.24, -0.12, 0.16, 0.7, -0.5, 0.54,
                       -0.62, 0.42, 0.6, 0.04, 0.66, -0.64, -0.8, -0.6, -0.08, -0.64,
                       0.58, 0.96, -0.36, -0.78, 0.58, 0.28, -0.66, -0.28, -0.94, 0.1,
                       0.1, 0.64]]
          , encoded = encode(array)
        assert.equal(encoded.length, data.length)
        assert.equal(encoded.length, 32 * 2 * 2)
        _.range(64).forEach(function(i) {
          approxEqual(encoded.readInt16LE(i * 2), data.readInt16LE(i * 2))
        })
        done()
      })
    })
    
  })

})