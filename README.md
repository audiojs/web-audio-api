Node Web Audio API
=====================

This library implements the [web audio API specification](https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html) on node.js.

Why the hell doing that??? I know it sounds crazy, so I guess I'll have to build a case for it, and write some blog posts.

And this is not even alpha. Use this library only if you're the adventurous kind.


What's implemented
-------------------

- AudioContext(partially)
- AudioParam (almost there)
- AudioBufferSourceNode
- ScriptProcessorNode
- GainNode


What's left to do
------------------

Most of the AudioNodes ...
Most of many other things ...
:(


Installation
--------------

```
npm install web-audio-api
```


Demo
------

Get ready, this is going to blow up your mind :

```
node test/manual-testing/AudioContext-sound-output.js
```


Streaming audio
-----------------

`AudioContext` just writes PCM data to a node writable stream. The default stream is a stream created with `Speaker`, which plays the audio back to your soundcard. But you can use any writable stream, file, including the `stdin` of a child process.

For example, here is an example for streaming audio to an [icecast](http://www.icecast.org/) server, using [ices](http://www.icecast.org/ices.php) :

```
var spawn = require('child_process').spawn
  , AudioContext = require('web-audio-api').AudioContext
  , context = new AudioContext()

var ices = spawn('ices', ['ices.xml'])
context.outStream = ices.stdin
``` 

Cool huh?


Extensions
-----------

Wow! The whole thing is not even half-done that there's already some extensions for it! See the list in [the wiki](https://github.com/sebpiq/node-web-audio-api/wiki/Extra-AudioNode-libraries-for-node-web-audio-api
).


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
mocha
```


Manual testing
----------------

To test the sound output : 

```
node test/manual-testing/AudioContext-sound-output.js
```

To test `AudioParam` against `AudioParam` implemented in a browser, open `test/manual-testing/AudioParam-browser-plots.html` in that browser.


Changelog
-----------

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
