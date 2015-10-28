Node Web Audio API
=====================

[![Build Status](https://travis-ci.org/sebpiq/node-web-audio-api.svg)](https://travis-ci.org/sebpiq/node-web-audio-api) [![Dependency Status](https://img.shields.io/gemnasium/sebpiq/node-web-audio-api.svg)](https://gemnasium.com/sebpiq/node-web-audio-api) [![Join the chat at https://gitter.im/sebpiq/node-web-audio-api](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/sebpiq/node-web-audio-api?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

This library implements the [web audio API specification](http://webaudio.github.io/web-audio-api/) on node.js.

And this is not even alpha. Use this library only if you're the adventurous kind.


What's implemented
-------------------

- AudioContext(partially)
- AudioParam (almost there)
- AudioBufferSourceNode
- ScriptProcessorNode
- GainNode
- OscillatorNode (coming soon)
- DelayNode (coming soon)


Installation
--------------

```
npm install web-audio-api
```


Demo
------

Get ready, this is going to blow up your mind :

```
npm install
gulp default
node test/manual-testing/AudioContext-sound-output.js
```


Audio output
-----------------

By default, **node-web-audio-api** doesn't play back the sound it generates. In fact, an `AudioContext` has no default output, and you need to give it a writable node stream to which it can write raw PCM audio. After creating an `AudioContext`, set its output stream like this : `audioContext.outStream = writableStream`.

### Example : playing back sound with **node-speaker**

This is probably the simplest way to play back audio. Install **node-speaker** with `npm install speaker`, then do something like this :

```javascript
var AudioContext = require('web-audio-api').AudioContext
  , context = new AudioContext
  , Speaker = require('speaker')

context.outStream = new Speaker({
  channels: context.format.numberOfChannels,
  bitDepth: context.format.bitDepth,
  sampleRate: context.sampleRate
})

// Create some audio nodes here to make some noise ...
```

### Example : playing back sound with **aplay**

Linux users can play back sound from **node-web-audio-api** by piping its output to [aplay](http://alsa.opensrc.org/Aplay). For this, simply send the generated sound straight to `stdout` like this :

```javascript
var AudioContext = require('web-audio-api').AudioContext
  , context = new AudioContext

context.outStream = process.stdout

// Create some audio nodes here to make some noise ...
```

Then start your script, piping it to **aplay** like so :

```
node myScript.js | aplay -f cd
```

### Example : creating an audio stream with **icecast2**

[icecast](http://icecast.org/) is a open-source streaming server. It works great, and is very easy to setup. **icecast** accepts connections from [different source clients](http://icecast.org/apps/) which provide the sound to encode and stream. [ices](http://www.icecast.org/ices/) is a client for **icecast** which accepts raw PCM audio from its standard input, and you can send sound from **node-web-audio-api** to **ices** (which will send it to icecast) by simply doing :

```
var spawn = require('child_process').spawn
  , AudioContext = require('web-audio-api').AudioContext
  , context = new AudioContext()

var ices = spawn('ices', ['ices.xml'])
context.outStream = ices.stdin
```

A live example is available on [Sébastien's website](http://funktion.fm/#/projects/versificator-rubbish-stream)


Using Gibber
---------------

[Gibber](https://github.com/charlieroberts/Gibber) is a great audiovisual live coding environment for the browser made by [Charlie Roberts](http://charlie-roberts.com). For audio, it uses Web Audio API, so you can run it on **node-web-audio-api**. First install gibber with npm : 

`npm install gibber.audio.lib`

Then to you can run the following test to see that everything works:

`npm test gibber.audio.lib`



Overall view of implementation
------------------------------

Each time you create an ```AudioNode``` (like for instance an ```AudioBufferSourceNode``` or a ```GainNode```), it inherits from ```DspObject``` which is in charge of two things:
- register schedule events with ```_schedule```
- compute the appropriate digital signal processing with ```_tick```

Each time you connect an ```AudioNode``` using ```source.connect(destination, output, input)``` it connects the relevant ```AudioOutput``` instances of ```source``` node the the relevant ```AudioInput``` instance of the ```destination``` node.

To instantiate all of these ```AudioNode```, you needed an overall ```AudioContext``` instance. This latter has a ```destination``` property (where the sound will flow out), instance of ```AudioDestinationNode```, which inherits from ```AudioNode```. The ```AudioContext``` instance keeps track of connections to the ```destination```. When that happens, it triggers the audio loop, calling ```_tick``` infinitely on the ```destination```, which will itself call ```_tick``` on its input ... and so forth go up on the whole audio graph.


Running the debugger
---------------------

Right now everything runs in one process, so if you set a break point in your code, there's going to be a lot of buffer underflows, and you won't be able to debug anything.

One trick is to kill the `AudioContext` right before the break point, like this:

```javascript
context._kill()
debugger
```

that way the audio loop is stopped, and you can inspect your objects in peace.


Running the tests
------------------

Tests are written with mocha. To run them, install mocha with :

```
npm install -g mocha
```

And in the root folder run :

```
npm test
```


Manual testing
----------------

To test the sound output, we need to install `node-speaker` (in addition of all the other dependencies), and build the library :

```
npm install
npm install speaker
gulp default
node test/manual-testing/AudioContext-sound-output.js
```

To test `AudioParam` against `AudioParam` implemented in a browser, open `test/manual-testing/AudioParam-browser-plots.html` in that browser.


Contributors
-------------

```
    61	Sébastien Piquemal
    16	ouhouhsami
     4	John Wnek
     2	anprogrammer
     1	Andrew Petersen
```

Changelog
-----------

#### 0.2.2

- removed `node-speaker` and `mathjs` dependencies

#### 0.2.1

- now use aurora installed from npm instead of distributing a built version of it.

#### 0.2.0

- refactored to ES6

#### 0.1.5

- **AudioNode** and **AudioContext** bug fixes

#### 0.1.4

- **audioports** : bug fixes

#### 0.1.3

- **audioports** : implemented `channelInterpretation` 'speakers'
- **AudioContext** : added support for mp3 to `decodeAudioData`

#### 0.1.2

- **AudioBufferSourceNode** : handler `onended` implemented
- **AudioContext** : method `decodeAudioData`, support only for wav

#### 0.1.1

- **ScriptProcessorNode**
- **AudioBufferSourceNode**
  - node is killed once it has finished playing
  - subsequent calls to `start` have no effect

- **AudioContext** : method `collectNodes`
- **audioports** : bug fixes

#### 0.1.0

- **AudioContext** (partial implementation)
- **AudioParam** (missing unschedule)
- **AudioBufferSourceNode** (missing onended)
- **GainNode**
