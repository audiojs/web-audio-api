# web-audio-api [![test](https://github.com/audiojs/web-audio-api/actions/workflows/test.yml/badge.svg)](https://github.com/audiojs/web-audio-api/actions/workflows/test.yml)

> Node.js implementation of Web audio API

This library implements the [Web Audio API specification](http://webaudio.github.io/web-audio-api/) (also know as WAA) on Node.js.


## What's Implemented

- AudioContext (partially)
- AudioParam (almost there)
- AudioBufferSourceNode
- ScriptProcessorNode
- GainNode
- OscillatorNode (coming soon)
- DelayNode (coming soon)


## Installation

```shell
npm install --save web-audio-api
```


## Demo

Get ready, this is going to blow up your mind :

```
npm install
npm run test-speaker
```


## Audio Output

By default, **web-audio-api** doesn't play back the sound it generates. In fact, an `AudioContext` has no default output, and you need to give it a writable node stream to which it can write raw PCM audio. After creating an `AudioContext`, set its output stream like this : `audioContext.outStream = writableStream`.

### Example: Playing back sound with **node-speaker**

This is probably the simplest way to play back audio. Install **node-speaker** with `npm install speaker`, then do something like this :

```javascript
import { AudioContext } from 'web-audio-api'
import Speaker from 'speaker'

const context = new AudioContext

context.outStream = new Speaker({
  channels: context.format.numberOfChannels,
  bitDepth: context.format.bitDepth,
  sampleRate: context.sampleRate
})

// Create some audio nodes here to make some noise ...
```

### Example : playing back sound with **aplay**

Linux users can play back sound from **web-audio-api** by piping its output to [aplay](http://alsa.opensrc.org/Aplay). For this, simply send the generated sound straight to `stdout` like this :

```javascript
import { AudioContext } from 'web-audio-api'

const context = new AudioContext

context.outStream = process.stdout

// Create some audio nodes here to make some noise ...
```

Then start your script, piping it to **aplay** like so :

```
node myScript.js | aplay -f cd
```

### Example : creating an audio stream with **icecast2**

[icecast](http://icecast.org/) is a open-source streaming server. It works great, and is very easy to setup. **icecast** accepts connections from [different source clients](http://icecast.org/apps/) which provide the sound to encode and stream. [ices](http://www.icecast.org/ices/) is a client for **icecast** which accepts raw PCM audio from its standard input, and you can send sound from **web-audio-api** to **ices** (which will send it to icecast) by simply doing :

```javascript
import { spawn } from 'child_process'
import AudioContext } from 'web-audio-api'

const context = new AudioContext()

const ices = spawn('ices', ['ices.xml'])
context.outStream = ices.stdin
```

A live example is available on [Sébastien's website](http://funktion.fm/#/projects/versificator-rubbish-stream)


## Using Gibber

[Gibber](https://github.com/charlieroberts/Gibber) is a great audiovisual live coding environment for the browser made by [Charlie Roberts](http://charlie-roberts.com). For audio, it uses Web Audio API, so you can run it on **web-audio-api**. First install gibber with npm :

`npm install gibber.audio.lib`

Then to you can run the following test to see that everything works:

`npm test gibber.audio.lib`


## Overall view of implementation

Each time you create an ```AudioNode``` (like for instance an ```AudioBufferSourceNode``` or a ```GainNode```), it inherits from ```DspObject``` which is in charge of two things:
- register schedule events with ```_schedule```
- compute the appropriate digital signal processing with ```_tick```

Each time you connect an ```AudioNode``` using ```source.connect(destination, output, input)``` it connects the relevant ```AudioOutput``` instances of ```source``` node to the relevant ```AudioInput``` instance of the ```destination``` node.

To instantiate all of these ```AudioNode```, you needed an overall ```AudioContext``` instance. This latter has a ```destination``` property (where the sound will flow out), instance of ```AudioDestinationNode```, which inherits from ```AudioNode```. The ```AudioContext``` instance keeps track of connections to the ```destination```. When that happens, it triggers the audio loop, calling ```_tick``` infinitely on the ```destination```, which will itself call ```_tick``` on its input ... and so forth go up on the whole audio graph.


## Running the debugger

Right now everything runs in one process, so if you set a break point in your code, there's going to be a lot of buffer underflows, and you won't be able to debug anything.

One trick is to kill the `AudioContext` right before the break point, like this:

```javascript
context._kill()
debugger
```

that way the audio loop is stopped, and you can inspect your objects in peace.


## Running the tests

Tests are written with mocha.

```
npm test
```


## Manual testing

You can test the sound output using `node-speaker`.

```
npm run test-speaker
```

To test `AudioParam` against `AudioParam` implemented in a browser, open `test/manual-testing/AudioParam-browser-plots.html` in that browser.


Contributors
-------------

```
    64	Sebastien Piquemal
    21	Sébastien Piquemal
    16	ouhouhsami
    10	fand
     6	Hugh Rawlinson
     4	John Wnek
     2	anprogrammer
     1	Andrew Petersen
     1	The Gitter Badger
     1	sebpiq
```

## Alternatives

* [web-audio-engine](https://github.com/mohayonao/web-audio-engine)
* [lab-sound](https://github.com/LabSound/LabSound)
* [node-audio](https://ghub.io/node-audio)
* [web-audio-js](https://github.com/descriptinc/web-audio-js)
* [WAAPISim](https://github.com/g200kg/WAAPISim)
* [web-audio-api-rs](https://github.com/orottier/web-audio-api-rs)

## License

MIT

<p align="center">🕉<p>
