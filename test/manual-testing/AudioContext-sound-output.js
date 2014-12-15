if (require.main === module) { // Just to avoid mocha running this
  var fs = require('fs')
    , AudioContext = require('../../build/AudioContext')
    , context = new AudioContext

  fs.readFile(__dirname + '/sounds/powerpad.wav', function(err, buffer) {
    if (err) throw err
    context.decodeAudioData(buffer, function(audioBuffer) {
      var bufferNode = context.createBufferSource()
      bufferNode.connect(context.destination)
      bufferNode.buffer = audioBuffer
      bufferNode.loop = true
      bufferNode.start(0)
    })
  })
}