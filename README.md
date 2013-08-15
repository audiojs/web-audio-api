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

`AudioContext` just writes PCM data to a node writable stream. The default stream is a stream created with `Speaker`, which plays the audio back to your soundcard. But you can use any writable stream, file, or stream the audio to an external process.

I used this to stream audio to an icecast server :

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

0.1.1

- ScriptProcessorNode

- AudioBufferSourceNode
  - node is killed once it has finished playing
  - subsequent calls to `start` have no effect

- AudioContext.collectNodes

- audioports bug fixes

0.1.0

- AudioContext (partial implementation)
- AudioParam (missing unschedule)
- AudioBufferSourceNode
- GainNode
