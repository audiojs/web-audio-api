if (require.main === module) {
  var fs = require('fs')
    , AudioBuffer = require('audiobuffer')
    , AudioContext = require('../../lib/AudioContext')
    , AudioBufferSourceNode = require('../../lib/AudioBufferSourceNode')
    , pcmUtils = require('pcm-boilerplate')
    , context = new AudioContext
    , decoder = pcmUtils.BufferDecoder({numberOfChannels: 2, sampleRate: context.sampleRate, bitDepth: 16})

  fs.readFile(__dirname + '/sounds/powerpad.raw', function(err, buffer) {
    if(err) throw err
    var bufferNode = new AudioBufferSourceNode(context)
    bufferNode.connect(context.destination)
    bufferNode.buffer = AudioBuffer.fromArray(decoder(buffer), context.sampleRate)
    bufferNode.loop = true
    bufferNode.loopStart = 1
    bufferNode.loopEnd = 2
    bufferNode.start(0)
  })
}