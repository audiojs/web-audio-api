# Changelog

#### 1.0.0

- [x] make ESM module
- [ ] simplify testing setup, remove outdated dependencies
- [ ] refactor nodes to follow sense of audio-worklet
- [ ] implent webassembly DSP
- [ ] add missing audio nodes
- [ ] make sure standardized-audio-context works

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
