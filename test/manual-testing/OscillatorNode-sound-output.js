if(require.main === module){
  var Speaker = require('speaker')
    , AudioContext = require('../../build/AudioContext')
    , context = new AudioContext
  if (Speaker){
    var s = new Speaker({
      numberOfChannels: 2, // 2 channels
      bitDepth: 16, // 16-bit samples
      sampleRate: 44100 // 44,100 Hz sample rate
    });
    context.outStream = s;
  }
  var osc = context.createOscillator()
  osc.type = process.argv[2]||"sine"
  var gain = context.createGain()
  var delay = context.createDelay(0.5)
  gain.gain.value = 0.25
  delay.delayTime.value = 0.5
  osc.connect(delay)
  osc.connect(gain)
  delay.connect(gain)
  gain.connect(context.destination)
  osc.start(0)
  osc.stop(context.currentTime+0.25)
}