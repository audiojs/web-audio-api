var Listen = require('../lib/Listen')
  , SoundFile = require('../lib/SoundFile')

if (require.main === module) {
  var listen = new Listen
    , soundfile = new SoundFile(__dirname + '/sounds/powerpad.mp3', {loop: true, start: 1, end: 3})

  soundfile.on('ready', function() {
    soundfile.connect(listen)
  })
}