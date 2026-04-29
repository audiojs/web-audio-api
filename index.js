export { default as BaseAudioContext } from './src/BaseAudioContext.js'
export { default as AudioContext } from './src/AudioContext.js'
export { default as OfflineAudioContext } from './src/OfflineAudioContext.js'
export { default as AudioParam } from './src/AudioParam.js'
export { default as AudioNode } from './src/AudioNode.js'
export { default as AudioScheduledSourceNode } from './src/AudioScheduledSourceNode.js'
export { default as AudioDestinationNode } from './src/AudioDestinationNode.js'
export { default as AudioBuffer } from 'audio-buffer'
export { default as AudioBufferSourceNode } from './src/AudioBufferSourceNode.js'
export { default as ConstantSourceNode } from './src/ConstantSourceNode.js'
export { default as OscillatorNode } from './src/OscillatorNode.js'
export { default as PeriodicWave } from './src/PeriodicWave.js'
export { default as GainNode } from './src/GainNode.js'
export { default as StereoPannerNode } from './src/StereoPannerNode.js'
export { default as DelayNode } from './src/DelayNode.js'
export { default as BiquadFilterNode } from './src/BiquadFilterNode.js'
export { default as WaveShaperNode } from './src/WaveShaperNode.js'
export { default as IIRFilterNode } from './src/IIRFilterNode.js'
export { default as ConvolverNode } from './src/ConvolverNode.js'
export { default as DynamicsCompressorNode } from './src/DynamicsCompressorNode.js'
export { default as ChannelSplitterNode } from './src/ChannelSplitterNode.js'
export { default as ChannelMergerNode } from './src/ChannelMergerNode.js'
export { default as AnalyserNode } from './src/AnalyserNode.js'
export { default as ScriptProcessorNode } from './src/ScriptProcessorNode.js'
export { default as PannerNode } from './src/PannerNode/index.js'
export { AudioWorkletNode, AudioWorkletProcessor } from './src/AudioWorklet.js'
export { MediaStreamAudioSourceNode, MediaStreamAudioDestinationNode, MediaElementAudioSourceNode } from './src/MediaStreamAudioSourceNode.js'
export { default as createMediaStream } from './src/createMediaStream.js'
export { default as AudioListener } from './src/AudioListener.js'
export { BLOCK_SIZE } from './src/constants.js'
export { InvalidStateError, NotSupportedError, IndexSizeError, InvalidAccessError, EncodingError } from './src/errors.js'

// Make AudioParam accessor properties enumerable on prototypes (Web IDL compliance).
// Browsers expose AudioParam-backed getters (e.g. gain, frequency, pan) as enumerable;
// ES6 class getters are non-enumerable by default. Only classes with AudioParam getters
// need this — add new classes here when they expose AudioParam properties.
import AudioParam from './src/AudioParam.js'
import GainNode from './src/GainNode.js'
import StereoPannerNode from './src/StereoPannerNode.js'
import DelayNode from './src/DelayNode.js'
import BiquadFilterNode from './src/BiquadFilterNode.js'
import OscillatorNode from './src/OscillatorNode.js'
import AudioBufferSourceNode from './src/AudioBufferSourceNode.js'
import DynamicsCompressorNode from './src/DynamicsCompressorNode.js'
import ConstantSourceNode from './src/ConstantSourceNode.js'
import PannerNode from './src/PannerNode/index.js'
import AudioListener from './src/AudioListener.js'

function makeEnumerable(proto) {
  for (let name of Object.getOwnPropertyNames(proto)) {
    let desc = Object.getOwnPropertyDescriptor(proto, name)
    if (desc.get && !desc.enumerable) {
      Object.defineProperty(proto, name, { ...desc, enumerable: true })
    }
  }
}

for (let cls of [GainNode, StereoPannerNode, DelayNode, BiquadFilterNode,
  OscillatorNode, AudioBufferSourceNode, DynamicsCompressorNode,
  ConstantSourceNode, PannerNode, AudioListener])
  makeEnumerable(cls.prototype)
