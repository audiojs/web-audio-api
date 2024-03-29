// if (require.main === module) { // Just to avoid mocha running this

import fs from 'fs'
import AudioContext from '../../src/AudioContext.js'
import Speaker from 'speaker'

const context = new AudioContext

console.log('encoding format : '
  + context.format.numberOfChannels + ' channels ; '
  + context.format.bitDepth + ' bits ; '
  + context.sampleRate + ' Hz'
)
context.outStream = new Speaker({
  channels: context.format.numberOfChannels,
  bitDepth: context.format.bitDepth,
  sampleRate: context.sampleRate
})

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
