/* Audio tests
 * These audio tests are there to make you ear the node web audio api lib
 */
var assert = require('assert'),
    fs = require('fs'),
    AudioContext = require('../build/AudioContext'),
    BLOCK_SIZE = require('../build/constants').BLOCK_SIZE

var context = new AudioContext()

describe('Audio tests', function() {
    describe('OscillatorNode', function() {
        it.skip('should output a 220 Hz sinus', function(done) {
            var oscillatorNode = context.createOscillator()
            oscillatorNode.connect(context.destination)
            oscillatorNode.frequency.value = 220
            oscillatorNode.start()
            setTimeout(function() {
                done()
            }, 500);
        })
        it.skip('should output a sawtooth from 220 Hz to 440 Hz in 0.5 second', function(done) {
            var oscillatorNode = context.createOscillator()
            oscillatorNode.connect(context.destination)
            oscillatorNode.type = "sawtooth"
            oscillatorNode.frequency.value = 220
            oscillatorNode.frequency.linearRampToValueAtTime(440, 0.5)
            oscillatorNode.start()
            setTimeout(function() {
                done()
            }, 1500);
        })
        it.skip('should output a 220 Hz with a linear detune factor', function(done) {
            var oscillatorNode = context.createOscillator()
            oscillatorNode.connect(context.destination)
            oscillatorNode.type = "square"
            oscillatorNode.frequency.value = 220
            oscillatorNode.detune.linearRampToValueAtTime(3200, 1.5)
            oscillatorNode.start()
            setTimeout(function() {
                done()
            }, 1500);
        })
        it('should set periodic wave accordingly', function(done) {
            var oscillatorNode = context.createOscillator()
            oscillatorNode.connect(context.destination)
            var real = new Float32Array(3);
            var imag = new Float32Array(3);
            real[0] = 0;
            imag[0] = 0;
            real[1] = 0.2;
            real[2] = 1;
            imag[1] = 0.8;
            imag[2] = 0;
            periodicWave = context.createPeriodicWave(real, imag)
            oscillatorNode.setPeriodicWave(periodicWave)
            oscillatorNode.frequency.value = 420
            oscillatorNode.start()
            setTimeout(function() {
                done()
            }, 1500);
        })
    })
    describe('AudioBufferSourceNode', function() {
        it.skip('should output an audio file', function(done) {
            fs.readFile(__dirname + '/manual-testing/sounds/powerpad.wav', function(err, buffer) {
                if (err) throw err
                context.decodeAudioData(buffer, function(audioBuffer) {
                    var bufferNode = context.createBufferSource()
                    bufferNode.connect(context.destination)
                    bufferNode.buffer = audioBuffer
                    bufferNode.loop = true
                    bufferNode.start(0)
                })
            })
            setTimeout(function() {
                done()
            }, 1500);
        })
    })
})
