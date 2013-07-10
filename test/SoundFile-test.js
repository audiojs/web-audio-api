var assert = require('assert')
  , async = require('async')
  , _ = require('underscore')
  , SoundFile = require('../lib/SoundFile')
  
describe('SoundFile', function() {

  describe('getBlock', function() {
  
    var round = function(array, dec) { return array.map(function(val) {
      dec = (dec !== undefined ? dec : 3)
      return Math.round(val * Math.pow(10, dec)) / Math.pow(10, dec)
    })}

    var round2 = function(val, dec) {
      dec = (dec !== undefined ? dec : 3)
      return Math.round(val * Math.pow(10, dec)) / Math.pow(10, dec)
    }
  
    it('should read mono 16-bits wav files', function(done) {
      var soundfile = new SoundFile(__dirname + '/sounds/steps-mono-16b-44khz.wav')
        , blocks = []
        
      soundfile.on('error', function(err) { console.error(err) })
      soundfile.on('ready', function() {
        assert.equal(soundfile.channels, 1)
        assert.equal(soundfile.format.bitDepth, 16)
        assert.equal(soundfile.format.channels, 1)
        assert.equal(soundfile.format.sampleRate, 44100)

        async.whilst(
          function() { return blocks.length < 22 },
          function(next) {
            soundfile.read(4410, function(err, block) {
              if (err) next(err)
              assert.equal(block.length, 1)
              assert.equal(block[0].length, 4410)
              blocks.push(block[0].slice(100, 105)) // Pd is not exact with timing
              next()
            })
          },
          function(err) {
            if (err) throw err
            assert.deepEqual(round(blocks[0]), [-1, -1, -1, -1, -1])
            assert.deepEqual(round(blocks[1]), [-0.9, -0.9, -0.9, -0.9, -0.9])
            assert.deepEqual(round(blocks[2]), [-0.8, -0.8, -0.8, -0.8, -0.8])
            assert.deepEqual(round(blocks[3]), [-0.7, -0.7, -0.7, -0.7, -0.7])
            assert.deepEqual(round(blocks[4]), [-0.6, -0.6, -0.6, -0.6, -0.6])
            assert.deepEqual(round(blocks[5]), [-0.5, -0.5, -0.5, -0.5, -0.5])
            assert.deepEqual(round(blocks[6]), [-0.4, -0.4, -0.4, -0.4, -0.4])
            assert.deepEqual(round(blocks[7]), [-0.3, -0.3, -0.3, -0.3, -0.3])
            assert.deepEqual(round(blocks[8]), [-0.2, -0.2, -0.2, -0.2, -0.2])
            assert.deepEqual(round(blocks[9]), [-0.1, -0.1, -0.1, -0.1, -0.1])
            assert.deepEqual(round(blocks[10]), [0, 0, 0, 0, 0])
            assert.deepEqual(round(blocks[11]), [0.1, 0.1, 0.1, 0.1, 0.1])
            assert.deepEqual(round(blocks[12]), [0.2, 0.2, 0.2, 0.2, 0.2])
            assert.deepEqual(round(blocks[13]), [0.3, 0.3, 0.3, 0.3, 0.3])
            assert.deepEqual(round(blocks[14]), [0.4, 0.4, 0.4, 0.4, 0.4])
            assert.deepEqual(round(blocks[15]), [0.5, 0.5, 0.5, 0.5, 0.5])
            assert.deepEqual(round(blocks[16]), [0.6, 0.6, 0.6, 0.6, 0.6])
            assert.deepEqual(round(blocks[17]), [0.7, 0.7, 0.7, 0.7, 0.7])
            assert.deepEqual(round(blocks[18]), [0.8, 0.8, 0.8, 0.8, 0.8])
            assert.deepEqual(round(blocks[19]), [0.9, 0.9, 0.9, 0.9, 0.9])
            assert.deepEqual(round(blocks[20]), [1, 1, 1, 1, 1])
            assert.deepEqual(round(blocks[21]), [0, 0, 0, 0, 0])
            assert.equal(soundfile.closed, true)
            done()
          }
        )
        
        
      })
    })

    it('should loop through a file if loop=true', function(done) {
      var soundfile = new SoundFile(__dirname + '/sounds/stepsShort-mono-16b-44khz.wav', {loop: true})
        , blocks = []
        
      soundfile.on('error', function(err) { console.error(err) })
      soundfile.on('ready', function() {
        assert.equal(soundfile.channels, 1)
        assert.equal(soundfile.format.bitDepth, 16)
        assert.equal(soundfile.format.channels, 1)
        assert.equal(soundfile.format.sampleRate, 44100)

        async.whilst(
          function() { return blocks.length < 22 },
          function(next) {
            soundfile.read(44100 * 0.02, function(err, block) {
              if (err) next(err)
              assert.equal(block.length, 1)
              assert.equal(block[0].length, 44100 * 0.02)
              blocks.push(block[0].slice(100, 105)) // Pd is not exact with timing
              next()
            })
          },
          function(err) {
            if (err) throw err
            assert.deepEqual(round(blocks[0]), [-1, -1, -1, -1, -1])
            assert.deepEqual(round(blocks[1]), [-0.8, -0.8, -0.8, -0.8, -0.8])
            assert.deepEqual(round(blocks[2]), [-0.6, -0.6, -0.6, -0.6, -0.6])
            assert.deepEqual(round(blocks[3]), [-0.4, -0.4, -0.4, -0.4, -0.4])
            assert.deepEqual(round(blocks[4]), [-0.2, -0.2, -0.2, -0.2, -0.2])
            assert.deepEqual(round(blocks[5]), [0, 0, 0, 0, 0])
            assert.deepEqual(round(blocks[6]), [0.2, 0.2, 0.2, 0.2, 0.2])
            assert.deepEqual(round(blocks[7]), [0.4, 0.4, 0.4, 0.4, 0.4])
            assert.deepEqual(round(blocks[8]), [0.6, 0.6, 0.6, 0.6, 0.6])
            assert.deepEqual(round(blocks[9]), [0.8, 0.8, 0.8, 0.8, 0.8])
            assert.deepEqual(round(blocks[10]), [-1, -1, -1, -1, -1])
            assert.deepEqual(round(blocks[11]), [-0.8, -0.8, -0.8, -0.8, -0.8])
            assert.deepEqual(round(blocks[12]), [-0.6, -0.6, -0.6, -0.6, -0.6])
            assert.deepEqual(round(blocks[13]), [-0.4, -0.4, -0.4, -0.4, -0.4])
            assert.deepEqual(round(blocks[14]), [-0.2, -0.2, -0.2, -0.2, -0.2])
            assert.deepEqual(round(blocks[15]), [0, 0, 0, 0, 0])
            assert.deepEqual(round(blocks[16]), [0.2, 0.2, 0.2, 0.2, 0.2])
            assert.deepEqual(round(blocks[17]), [0.4, 0.4, 0.4, 0.4, 0.4])
            assert.deepEqual(round(blocks[18]), [0.6, 0.6, 0.6, 0.6, 0.6])
            assert.deepEqual(round(blocks[19]), [0.8, 0.8, 0.8, 0.8, 0.8])
            assert.deepEqual(round(blocks[20]), [-1, -1, -1, -1, -1])
            assert.deepEqual(round(blocks[21]), [-0.8, -0.8, -0.8, -0.8, -0.8])
            assert.equal(soundfile.closed, false)
            done()
          }
        )
        
        
      })
    })

    it('should work with start and end options', function(done) {
      var soundfile = new SoundFile(__dirname + '/sounds/stepsShort-mono-16b-44khz.wav', {start: 0.0392, end: 0.0594})
        , blocks = []
        , blockSize = Math.round((0.0594 - 0.0392) * 44100)
        
      soundfile.on('error', function(err) { console.error(err) })
      soundfile.on('ready', function() {
        assert.equal(soundfile.channels, 1)
        assert.equal(soundfile.format.bitDepth, 16)
        assert.equal(soundfile.format.channels, 1)
        assert.equal(soundfile.format.sampleRate, 44100)

        async.whilst(
          function() { return blocks.length < 2},
          function(next) {
            soundfile.read(blockSize, function(err, block) {
              if (err) next(err)
              assert.equal(block.length, 1)
              assert.equal(block[0].length, blockSize)
              blocks.push(block[0])
              next()
            })
          },
          function(err) {
            if (err) throw err
            blocks[0].slice(44, -44).forEach(function(val) {
              assert.equal(round2(val), -0.6)
            })
            blocks[1].slice(44, -44).forEach(function(val) {
              assert.equal(round2(val), 0)
            })
            assert.equal(soundfile.closed, true)
            done()
          }
        )
        
        
      })
    })

    it('should work with start option only', function(done) {
      var soundfile = new SoundFile(__dirname + '/sounds/stepsShort-mono-16b-44khz.wav', {start: 0.1594})
        , blocks = []
        , blockSize = Math.round((0.1796 - 0.1594) * 44100)
        
      soundfile.on('error', function(err) { console.error(err) })
      soundfile.on('ready', function() {
        assert.equal(soundfile.channels, 1)
        assert.equal(soundfile.format.bitDepth, 16)
        assert.equal(soundfile.format.channels, 1)
        assert.equal(soundfile.format.sampleRate, 44100)

        async.whilst(
          function() { return blocks.length < 3},
          function(next) {
            soundfile.read(blockSize, function(err, block) {
              if (err) next(err)
              assert.equal(block.length, 1)
              assert.equal(block[0].length, blockSize)
              blocks.push(block[0])
              next()
            })
          },
          function(err) {
            if (err) throw err
            blocks[0].slice(44, -44).forEach(function(val) {
              assert.equal(round2(val), 0.6)
            })
            blocks[1].slice(44, -44).forEach(function(val) {
              assert.equal(round2(val), 0.8)
            })
            blocks[2].slice(44, -44).forEach(function(val) {
              assert.equal(round2(val), 0)
            })
            assert.equal(soundfile.closed, true)
            done()
          }
        )
        
        
      })
    })

    it('should work with end option only', function(done) {
      var soundfile = new SoundFile(__dirname + '/sounds/stepsShort-mono-16b-44khz.wav', {end: 0.0391})
        , blocks = []
        , blockSize = Math.round((0.0391 / 2) * 44100)
        
      soundfile.on('error', function(err) { console.error(err) })
      soundfile.on('ready', function() {
        assert.equal(soundfile.channels, 1)
        assert.equal(soundfile.format.bitDepth, 16)
        assert.equal(soundfile.format.channels, 1)
        assert.equal(soundfile.format.sampleRate, 44100)

        async.whilst(
          function() { return blocks.length < 3},
          function(next) {
            soundfile.read(blockSize, function(err, block) {
              if (err) next(err)
              assert.equal(block.length, 1)
              assert.equal(block[0].length, blockSize)
              blocks.push(block[0])
              next()
            })
          },
          function(err) {
            if (err) throw err
            blocks[0].slice(44, -44).forEach(function(val) {
              assert.equal(round2(val), -1)
            })
            blocks[1].slice(44, -44).forEach(function(val) {
              assert.equal(round2(val), -0.8)
            })
            blocks[2].slice(44, -44).forEach(function(val) {
              assert.equal(round2(val), 0)
            })
            assert.equal(soundfile.closed, true)
            done()
          }
        )
        
        
      })
    })

    it('should work with start, end and loop options', function(done) {
      var soundfile = new SoundFile(__dirname + '/sounds/stepsShort-mono-16b-44khz.wav',
          {start: 0.0392, end: 0.0798, loop: true})
        , blocks = []
        , blockSize = Math.round((0.0798 - 0.0392) * 0.5 * 44100)
        
      soundfile.on('error', function(err) { console.error(err) })
      soundfile.on('ready', function() {
        assert.equal(soundfile.channels, 1)
        assert.equal(soundfile.format.bitDepth, 16)
        assert.equal(soundfile.format.channels, 1)
        assert.equal(soundfile.format.sampleRate, 44100)

        async.whilst(
          function() { return blocks.length < 5},
          function(next) {
            soundfile.read(blockSize, function(err, block) {
              if (err) next(err)
              assert.equal(block.length, 1)
              assert.equal(block[0].length, blockSize)
              blocks.push(block[0])
              next()
            })
          },
          function(err) {
            if (err) throw err
            blocks[0].slice(44, -44).forEach(function(val) {
              assert.equal(round2(val), -0.6)
            })
            blocks[1].slice(44, -44).forEach(function(val) {
              assert.equal(round2(val), -0.4)
            })
            blocks[2].slice(44, -44).forEach(function(val) {
              assert.equal(round2(val), -0.6)
            })
            blocks[3].slice(44, -44).forEach(function(val) {
              assert.equal(round2(val), -0.4)
            })
            blocks[4].slice(44, -44).forEach(function(val) {
              assert.equal(round2(val), -0.6)
            })
            assert.equal(soundfile.closed, false)
            done()
          }
        )
        
      })
    })

    it('should read mono mp3 files', function(done) {
      var soundfile = new SoundFile(__dirname + '/sounds/steps-mono-44khz.mp3')
        , blocks = []
        
      soundfile.on('error', function(err) { console.error(err) })
      soundfile.on('ready', function() {
        assert.equal(soundfile.channels, 1)
        assert.equal(soundfile.format.bitDepth, 16)
        assert.equal(soundfile.format.channels, 1)
        assert.equal(soundfile.format.sampleRate, 44100)

        async.whilst(
          function() { return blocks.length < 22 },
          function(next) {
            soundfile.read(4410, function(err, block) {
              if (err) next(err)
              assert.equal(block.length, 1)
              assert.equal(block[0].length, 4410)
              blocks.push(block[0].slice(100, 105)) // Pd is not exact with timing
              next()
            })
          },
          function(err) {
            if (err) throw err
            assert.deepEqual(round(blocks[0], 0), [-1, -1, -1, -1, -1])
            assert.deepEqual(round(blocks[1], 1), [-0.9, -0.9, -0.9, -0.9, -0.9])
            assert.deepEqual(round(blocks[2], 1), [-0.8, -0.8, -0.8, -0.8, -0.8])
            assert.deepEqual(round(blocks[3], 1), [-0.7, -0.7, -0.7, -0.7, -0.7])
            assert.deepEqual(round(blocks[4], 1), [-0.6, -0.6, -0.6, -0.6, -0.6])
            assert.deepEqual(round(blocks[5], 1), [-0.5, -0.5, -0.5, -0.5, -0.5])
            assert.deepEqual(round(blocks[6], 1), [-0.4, -0.4, -0.4, -0.4, -0.4])
            assert.deepEqual(round(blocks[7], 1), [-0.3, -0.3, -0.3, -0.3, -0.3])
            assert.deepEqual(round(blocks[8], 1), [-0.2, -0.2, -0.2, -0.2, -0.2])
            assert.deepEqual(round(blocks[9], 1), [-0.1, -0.1, -0.1, -0.1, -0.1])
            assert.deepEqual(round(blocks[10], 1), [0, 0, 0, 0, 0])
            assert.deepEqual(round(blocks[11], 1), [0.1, 0.1, 0.1, 0.1, 0.1])
            assert.deepEqual(round(blocks[12], 1), [0.2, 0.2, 0.2, 0.2, 0.2])
            assert.deepEqual(round(blocks[13], 1), [0.3, 0.3, 0.3, 0.3, 0.3])
            assert.deepEqual(round(blocks[14], 1), [0.4, 0.4, 0.4, 0.4, 0.4])
            assert.deepEqual(round(blocks[15], 1), [0.5, 0.5, 0.5, 0.5, 0.5])
            assert.deepEqual(round(blocks[16], 1), [0.6, 0.6, 0.6, 0.6, 0.6])
            assert.deepEqual(round(blocks[17], 1), [0.7, 0.7, 0.7, 0.7, 0.7])
            assert.deepEqual(round(blocks[18], 1), [0.8, 0.8, 0.8, 0.8, 0.8])
            assert.deepEqual(round(blocks[19], 1), [0.9, 0.9, 0.9, 0.9, 0.9])
            assert.deepEqual(round(blocks[20], 0), [1, 1, 1, 1, 1])
            assert.deepEqual(round(blocks[21], 0), [0, 0, 0, 0, 0])
            assert.equal(soundfile.closed, true)
            done()
          }
        )
        
        
      })
    })

    it('should read stereo 16-bits ogg files', function(done) {
      var soundfile = new SoundFile(__dirname + '/sounds/steps-stereo-16b-44khz.ogg')
        , blocks = []
        
      soundfile.on('error', function(err) { console.error(err) })
      soundfile.on('ready', function() {
        assert.equal(soundfile.channels, 2)
        assert.equal(soundfile.format.bitDepth, 16)
        assert.equal(soundfile.format.channels, 2)
        assert.equal(soundfile.format.sampleRate, 44100)

        async.whilst(
          function() { return blocks.length < 23 },
          function(next) {
            soundfile.read(4410, function(err, block) {
              if (err) next(err)
              assert.equal(block.length, 2)
              assert.equal(block[0].length, 4410)
              assert.equal(block[1].length, 4410)
              blocks.push([block[0].slice(100, 102), block[1].slice(100, 102)]) // Pd is not exact with timing
              next()
            })
          },
          function(err) {
            if (err) throw err
            assert.deepEqual([round(blocks[0][0]), round(blocks[0][1])], [[-1, -1], [1, 1]])
            assert.deepEqual([round(blocks[1][0], 1), round(blocks[1][1], 1)], [[-0.9, -0.9], [0.9, 0.9]])
            assert.deepEqual([round(blocks[2][0], 1), round(blocks[2][1], 1)], [[-0.8, -0.8], [0.8, 0.8]])
            assert.deepEqual([round(blocks[3][0], 1), round(blocks[3][1], 1)], [[-0.7, -0.7], [0.7, 0.7]])
            assert.deepEqual([round(blocks[4][0], 1), round(blocks[4][1], 1)], [[-0.6, -0.6], [0.6, 0.6]])
            assert.deepEqual([round(blocks[5][0], 1), round(blocks[5][1], 1)], [[-0.5, -0.5], [0.5, 0.5]])
            assert.deepEqual([round(blocks[6][0], 1), round(blocks[6][1], 1)], [[-0.4, -0.4], [0.4, 0.4]])
            assert.deepEqual([round(blocks[7][0], 1), round(blocks[7][1], 1)], [[-0.3, -0.3], [0.3, 0.3]])
            assert.deepEqual([round(blocks[8][0], 1), round(blocks[8][1], 1)], [[-0.2, -0.2], [0.2, 0.2]])
            assert.deepEqual([round(blocks[9][0], 1), round(blocks[9][1], 1)], [[-0.1, -0.1], [0.1, 0.1]])
            assert.deepEqual([round(blocks[10][0], 1), round(blocks[10][1], 1)], [[0, 0], [0, 0]])
            assert.deepEqual([round(blocks[11][0], 1), round(blocks[11][1], 1)], [[0.1, 0.1], [-0.1, -0.1]])
            assert.deepEqual([round(blocks[12][0], 1), round(blocks[12][1], 1)], [[0.2, 0.2], [-0.2, -0.2]])
            assert.deepEqual([round(blocks[13][0], 1), round(blocks[13][1], 1)], [[0.3, 0.3], [-0.3, -0.3]])
            assert.deepEqual([round(blocks[14][0], 1), round(blocks[14][1], 1)], [[0.4, 0.4], [-0.4, -0.4]])
            assert.deepEqual([round(blocks[15][0], 1), round(blocks[15][1], 1)], [[0.5, 0.5], [-0.5, -0.5]])
            assert.deepEqual([round(blocks[16][0], 1), round(blocks[16][1], 1)], [[0.6, 0.6], [-0.6, -0.6]])
            assert.deepEqual([round(blocks[17][0], 1), round(blocks[17][1], 1)], [[0.7, 0.7], [-0.7, -0.7]])
            assert.deepEqual([round(blocks[18][0], 1), round(blocks[18][1], 1)], [[0.8, 0.8], [-0.8, -0.8]])
            assert.deepEqual([round(blocks[19][0], 1), round(blocks[19][1], 1)], [[0.9, 0.9], [-0.9, -0.9]])
            assert.deepEqual([round(blocks[20][0], 1), round(blocks[20][1], 1)], [[1, 1], [-1, -1]])
            assert.deepEqual([blocks[22][0], blocks[22][1]], [[0, 0], [0, 0]])
            assert.equal(soundfile.closed, true)
            done()
          }
        )
        
        
      })
    })

    it('should return an error if the file doesn\'t exist', function(done) {
      var soundfile = new SoundFile(__dirname + '/sounds/wot.ogg')
        , blocks = []
      soundfile.on('error', function(err) {
        assert.ok(err)
        done()
      })
    })

  })

})