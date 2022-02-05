import _ from 'underscore'
import fs from 'fs'
import assert from 'assert'
import AudioBuffer from '../src/AudioBuffer.js'
import * as utils from '../src/utils.js'
import initHelpers from './helpers.js'

let helpers = initHelpers({approx: 0.0005})
const {assertAllValuesApprox, assertApproxEqual} = helpers

describe('utils.js', function() {

  describe('decodeAudioData', function() {


    var reblock = function(audioBuffer, blockSize) {
      var blocks = []
      while(audioBuffer.length) {
        blocks.push(audioBuffer.slice(0, blockSize))
        audioBuffer = audioBuffer.slice(blockSize)
      }
      return blocks
    }

    // Test cases for the files "steps-*-mono.wav"
    var testStepsMono = function(blocks, helpers) {
      helpers.assertAllValuesApprox(blocks[0].getChannelData(0), -1)
      helpers.assertAllValuesApprox(blocks[1].getChannelData(0), -0.9)
      helpers.assertAllValuesApprox(blocks[2].getChannelData(0), -0.8)
      helpers.assertAllValuesApprox(blocks[3].getChannelData(0), -0.7)
      helpers.assertAllValuesApprox(blocks[4].getChannelData(0), -0.6)
      helpers.assertAllValuesApprox(blocks[5].getChannelData(0), -0.5)
      helpers.assertAllValuesApprox(blocks[6].getChannelData(0), -0.4)
      helpers.assertAllValuesApprox(blocks[7].getChannelData(0), -0.3)
      helpers.assertAllValuesApprox(blocks[8].getChannelData(0), -0.2)
      helpers.assertAllValuesApprox(blocks[9].getChannelData(0), -0.1)
      helpers.assertAllValuesApprox(blocks[10].getChannelData(0), 0)
      helpers.assertAllValuesApprox(blocks[11].getChannelData(0), 0.1)
      helpers.assertAllValuesApprox(blocks[12].getChannelData(0), 0.2)
      helpers.assertAllValuesApprox(blocks[13].getChannelData(0), 0.3)
      helpers.assertAllValuesApprox(blocks[14].getChannelData(0), 0.4)
      helpers.assertAllValuesApprox(blocks[15].getChannelData(0), 0.5)
      helpers.assertAllValuesApprox(blocks[16].getChannelData(0), 0.6)
      helpers.assertAllValuesApprox(blocks[17].getChannelData(0), 0.7)
      helpers.assertAllValuesApprox(blocks[18].getChannelData(0), 0.8)
      helpers.assertAllValuesApprox(blocks[19].getChannelData(0), 0.9)
      helpers.assertAllValuesApprox(blocks[20].getChannelData(0), 1)
    }

    // Test cases for the files "steps-*-stereo.wav"
    var testStepsStereo = function(blocks, helpers) {
      helpers.assertAllValuesApprox(blocks[0].getChannelData(0), -1)
      helpers.assertAllValuesApprox(blocks[0].getChannelData(1), 1)
      helpers.assertAllValuesApprox(blocks[1].getChannelData(0), -0.9)
      helpers.assertAllValuesApprox(blocks[1].getChannelData(1), 0.9)
      helpers.assertAllValuesApprox(blocks[2].getChannelData(0), -0.8)
      helpers.assertAllValuesApprox(blocks[2].getChannelData(1), 0.8)
      helpers.assertAllValuesApprox(blocks[3].getChannelData(0), -0.7)
      helpers.assertAllValuesApprox(blocks[3].getChannelData(1), 0.7)
      helpers.assertAllValuesApprox(blocks[4].getChannelData(0), -0.6)
      helpers.assertAllValuesApprox(blocks[4].getChannelData(1), 0.6)
      helpers.assertAllValuesApprox(blocks[5].getChannelData(0), -0.5)
      helpers.assertAllValuesApprox(blocks[5].getChannelData(1), 0.5)
      helpers.assertAllValuesApprox(blocks[6].getChannelData(0), -0.4)
      helpers.assertAllValuesApprox(blocks[6].getChannelData(1), 0.4)
      helpers.assertAllValuesApprox(blocks[7].getChannelData(0), -0.3)
      helpers.assertAllValuesApprox(blocks[7].getChannelData(1), 0.3)
      helpers.assertAllValuesApprox(blocks[8].getChannelData(0), -0.2)
      helpers.assertAllValuesApprox(blocks[8].getChannelData(1), 0.2)
      helpers.assertAllValuesApprox(blocks[9].getChannelData(0), -0.1)
      helpers.assertAllValuesApprox(blocks[9].getChannelData(1), 0.1)

      helpers.assertAllValuesApprox(blocks[10].getChannelData(0), 0)
      helpers.assertAllValuesApprox(blocks[10].getChannelData(1), 0)

      helpers.assertAllValuesApprox(blocks[11].getChannelData(0), 0.1)
      helpers.assertAllValuesApprox(blocks[11].getChannelData(1), -0.1)
      helpers.assertAllValuesApprox(blocks[12].getChannelData(0), 0.2)
      helpers.assertAllValuesApprox(blocks[12].getChannelData(1), -0.2)
      helpers.assertAllValuesApprox(blocks[13].getChannelData(0), 0.3)
      helpers.assertAllValuesApprox(blocks[13].getChannelData(1), -0.3)
      helpers.assertAllValuesApprox(blocks[14].getChannelData(0), 0.4)
      helpers.assertAllValuesApprox(blocks[14].getChannelData(1), -0.4)
      helpers.assertAllValuesApprox(blocks[15].getChannelData(0), 0.5)
      helpers.assertAllValuesApprox(blocks[15].getChannelData(1), -0.5)
      helpers.assertAllValuesApprox(blocks[16].getChannelData(0), 0.6)
      helpers.assertAllValuesApprox(blocks[16].getChannelData(1), -0.6)
      helpers.assertAllValuesApprox(blocks[17].getChannelData(0), 0.7)
      helpers.assertAllValuesApprox(blocks[17].getChannelData(1), -0.7)
      helpers.assertAllValuesApprox(blocks[18].getChannelData(0), 0.8)
      helpers.assertAllValuesApprox(blocks[18].getChannelData(1), -0.8)
      helpers.assertAllValuesApprox(blocks[19].getChannelData(0), 0.9)
      helpers.assertAllValuesApprox(blocks[19].getChannelData(1), -0.9)
      helpers.assertAllValuesApprox(blocks[20].getChannelData(0), 1)
      helpers.assertAllValuesApprox(blocks[20].getChannelData(1), -1)
    }

    it('should decode a 16b mono wav (by callback)', function(done) {
      fs.readFile(new URL('./sounds/steps-mono-16b-44khz.wav', import.meta.url), function(err, buf) {
        if (err) throw err
        utils.decodeAudioData(buf, function(err, audioBuffer) {
          if (err) throw err
          assert.equal(audioBuffer.numberOfChannels, 1)
          assert.equal(audioBuffer.length, 21 * 4410)
          assert.equal(audioBuffer.sampleRate, 44100)
          testStepsMono(reblock(audioBuffer, 4410), helpers)
          done()
        })
      })
    })

    it('should decode a 16b mono wav (by Promise)', function(done) {
      fs.readFile(new URL('./sounds/steps-mono-16b-44khz.wav', import.meta.url), function(err, buf) {
        if (err) throw err
        utils.decodeAudioData(buf).then(function(audioBuffer) {
          assert.equal(audioBuffer.numberOfChannels, 1)
          assert.equal(audioBuffer.length, 21 * 4410)
          assert.equal(audioBuffer.sampleRate, 44100)
          testStepsMono(reblock(audioBuffer, 4410), helpers)
          done()
        }).catch(function(err) {
        })
      })
    })

    it('should decode a 16b stereo wav (by callback)', function(done) {
      fs.readFile(new URL('./sounds/steps-stereo-16b-44khz.wav', import.meta.url), function(err, buf) {
        if (err) throw err
        utils.decodeAudioData(buf, function(err, audioBuffer) {
          if (err) throw err
          assert.equal(audioBuffer.numberOfChannels, 2)
          assert.equal(audioBuffer.length, 21 * 4410)
          assert.equal(audioBuffer.sampleRate, 44100)
          testStepsStereo(reblock(audioBuffer, 4410), helpers)
          done()
        })
      })
    })

    it('should decode a 16b stereo wav (by Promise)', function(done) {
      fs.readFile(new URL('./sounds/steps-stereo-16b-44khz.wav', import.meta.url), function(err, buf) {
        if (err) throw err
        utils.decodeAudioData(buf).then(function(audioBuffer) {
          assert.equal(audioBuffer.numberOfChannels, 2)
          assert.equal(audioBuffer.length, 21 * 4410)
          assert.equal(audioBuffer.sampleRate, 44100)
          testStepsStereo(reblock(audioBuffer, 4410), helpers)
          done()
        }).catch(function(err) {
        })
      })
    })

    it('should decode a 16b stereo mp3 (by callback)', function(done) {
      fs.readFile(new URL('./sounds/steps-stereo-16b-44khz.mp3', import.meta.url), function(err, buf) {
        if (err) throw err
        utils.decodeAudioData(buf, function(err, audioBuffer) {
          if (err) throw err
          var block1 = _.range(4410).map(function() { return 1 })
            , blockm1 = _.range(4410).map(function() { return -1 })

          assert.equal(audioBuffer.numberOfChannels, 2)
          assert.ok(audioBuffer.length >= 21 * 4410)
          assert.equal(audioBuffer.sampleRate, 44100)

          // Strip the silence at the beginning of the mp3 file
          audioBuffer = audioBuffer.slice(audioBuffer.length - 21 * 4410)

          // Strip the -1 and 1 blocks, cause encoding makes them totally wrong
          audioBuffer = audioBuffer.slice(4410, audioBuffer.length - 4410)

          // Add fake blocks, just for the tests
          audioBuffer = AudioBuffer.fromArray([blockm1, block1], 44100).concat(audioBuffer)
          audioBuffer = audioBuffer.concat(AudioBuffer.fromArray([block1, blockm1], 44100))

          testStepsStereo(reblock(audioBuffer, 4410), initHelpers({approx: 0.2}))
          done()
        })
      })
    })

    it('should decode a 16b stereo mp3 (by Promise)', function(done) {
      fs.readFile(new URL('./sounds/steps-stereo-16b-44khz.mp3', import.meta.url), function(err, buf) {
        if (err) throw err
        utils.decodeAudioData(buf).then(function(audioBuffer) {
          var block1 = _.range(4410).map(function() { return 1 })
            , blockm1 = _.range(4410).map(function() { return -1 })

          assert.equal(audioBuffer.numberOfChannels, 2)
          assert.ok(audioBuffer.length >= 21 * 4410)
          assert.equal(audioBuffer.sampleRate, 44100)

          // Strip the silence at the beginning of the mp3 file
          audioBuffer = audioBuffer.slice(audioBuffer.length - 21 * 4410)

          // Strip the -1 and 1 blocks, cause encoding makes them totally wrong
          audioBuffer = audioBuffer.slice(4410, audioBuffer.length - 4410)

          // Add fake blocks, just for the tests
          audioBuffer = AudioBuffer.fromArray([blockm1, block1], 44100).concat(audioBuffer)
          audioBuffer = audioBuffer.concat(AudioBuffer.fromArray([block1, blockm1], 44100))

          testStepsStereo(reblock(audioBuffer, 4410), initHelpers({approx: 0.2}))
          done()
        }).catch(function(err) {
          console.log(err)
        })
      })
    })

    it('should return an error if the format couldn\'t be recognized (by callback)', function(done) {
      fs.readFile(new URL('./sounds/generateFile.pd', import.meta.url), function(err, buf) {
        if (err) throw err
        utils.decodeAudioData(buf, function(err, audioBuffer) {
          assert.ok(err)
          assert.ok(!audioBuffer)
          done()
        })
      })
    })

    it('should return an error if the format couldn\'t be recognized (by Promise)', function(done) {
      fs.readFile(new URL('./sounds/generateFile.pd', import.meta.url), function(err, buf) {
        if (err) throw err
        utils.decodeAudioData(buf).then(function(audioBuffer) {
        }).catch(function(err) {
          assert.ok(err)
          done()
        })
      })
    })

  })

})
