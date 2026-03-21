import fs from 'fs'
import AudioContext from '../../src/AudioContext.js'
import Speaker from 'speaker'

const speaker = new Speaker({ channels: 2, bitDepth: 16, sampleRate: 44100 })
const context = new AudioContext({ sinkId: speaker })

fs.readFile(new URL('./sounds/powerpad.wav', import.meta.url), function(err, buffer) {
  if (err) throw err
  context.decodeAudioData(buffer, function(audioBuffer) {
    var bufferNode = context.createBufferSource()
    bufferNode.connect(context.destination)
    bufferNode.buffer = audioBuffer
    bufferNode.loop = true
    bufferNode.start(0)
  })
})
