// Type declarations for web-audio-api

export class AudioBuffer {
  constructor(options: { length: number; sampleRate: number; numberOfChannels?: number });
  constructor(numberOfChannels: number, length: number, sampleRate: number);
  readonly sampleRate: number;
  readonly length: number;
  readonly duration: number;
  readonly numberOfChannels: number;
  getChannelData(channel: number): Float32Array;
  copyFromChannel(destination: Float32Array, channelNumber: number, startInChannel?: number): void;
  copyToChannel(source: Float32Array, channelNumber: number, startInChannel?: number): void;
  slice(start?: number, end?: number): AudioBuffer;
  concat(other: AudioBuffer): AudioBuffer;
  set(other: AudioBuffer, offset?: number): void;
  static fromArray(arrays: Float32Array[], sampleRate: number): AudioBuffer;
  static filledWithVal(val: number, numberOfChannels: number, length: number, sampleRate: number): AudioBuffer;
}

export class AudioParam extends EventTarget {
  readonly defaultValue: number;
  value: number;
  setValueAtTime(value: number, startTime: number): void;
  linearRampToValueAtTime(value: number, endTime: number): void;
  exponentialRampToValueAtTime(value: number, endTime: number): void;
  setTargetAtTime(target: number, startTime: number, timeConstant: number): void;
  setValueCurveAtTime(values: number[] | Float32Array, startTime: number, duration: number): void;
  cancelScheduledValues(startTime: number): void;
  cancelAndHoldAtTime(cancelTime: number): void;
}

export class AudioNode extends EventTarget {
  readonly context: BaseAudioContext;
  readonly numberOfInputs: number;
  readonly numberOfOutputs: number;
  channelCount: number;
  channelCountMode: 'max' | 'clamped-max' | 'explicit';
  channelInterpretation: 'speakers' | 'discrete';
  connect(destination: AudioNode, output?: number, input?: number): AudioNode;
  disconnect(output?: number): void;
  disconnect(destination: AudioNode, output?: number, input?: number): void;
  [Symbol.dispose](): void;
}

export class AudioScheduledSourceNode extends AudioNode {
  onended: ((event: Event) => void) | null;
  start(when?: number): void;
  stop(when?: number): void;
}

export class BaseAudioContext extends EventTarget {
  readonly destination: AudioDestinationNode;
  readonly listener: AudioListener;
  readonly sampleRate: number;
  readonly currentTime: number;
  readonly state: 'suspended' | 'running' | 'closed';
  readonly audioWorklet: { addModule(setup: (scope: any) => void): Promise<void> };
  onstatechange: ((event: Event) => void) | null;
  oncomplete: ((event: Event) => void) | null;
  createBuffer(numberOfChannels: number, length: number, sampleRate: number): AudioBuffer;
  decodeAudioData(audioData: ArrayBuffer | Uint8Array, successCallback?: (buffer: AudioBuffer) => void, errorCallback?: (error: Error) => void): Promise<AudioBuffer>;
  createBufferSource(): AudioBufferSourceNode;
  createConstantSource(): ConstantSourceNode;
  createOscillator(): OscillatorNode;
  createPeriodicWave(real: Float32Array, imag: Float32Array, constraints?: { disableNormalization?: boolean }): PeriodicWave;
  createGain(): GainNode;
  createStereoPanner(): StereoPannerNode;
  createDelay(maxDelayTime?: number): DelayNode;
  createBiquadFilter(): BiquadFilterNode;
  createWaveShaper(): WaveShaperNode;
  createIIRFilter(feedforward: number[], feedback: number[]): IIRFilterNode;
  createConvolver(): ConvolverNode;
  createDynamicsCompressor(): DynamicsCompressorNode;
  createChannelSplitter(numberOfOutputs?: number): ChannelSplitterNode;
  createChannelMerger(numberOfInputs?: number): ChannelMergerNode;
  createAnalyser(): AnalyserNode;
  createScriptProcessor(bufferSize: number, numberOfInputChannels: number, numberOfOutputChannels: number): ScriptProcessorNode;
  createPanner(): PannerNode;
  createMediaStreamSource(mediaStream: any): MediaStreamAudioSourceNode;
  createMediaStreamDestination(): MediaStreamAudioDestinationNode;
}

export class AudioContext extends BaseAudioContext {
  constructor(options?: { sampleRate?: number; numberOfChannels?: number; bitDepth?: number });
  readonly numberOfChannels: number;
  readonly baseLatency: number;
  readonly outputLatency: number;
  outStream: any;
  format: { numberOfChannels: number; bitDepth: number; sampleRate: number };
  suspend(): Promise<void>;
  resume(): Promise<void>;
  close(): Promise<void>;
  [Symbol.dispose](): void;
}

export class OfflineAudioContext extends BaseAudioContext {
  constructor(numberOfChannels: number, length: number, sampleRate: number);
  readonly length: number;
  readonly renderedBuffer: AudioBuffer | null;
  startRendering(): Promise<AudioBuffer>;
}

export class AudioDestinationNode extends AudioNode {
  readonly maxChannelCount: number;
}

export class AudioBufferSourceNode extends AudioScheduledSourceNode {
  buffer: AudioBuffer | null;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  readonly playbackRate: AudioParam;
  start(when?: number, offset?: number, duration?: number): void;
}

export class ConstantSourceNode extends AudioScheduledSourceNode {
  readonly offset: AudioParam;
}

export class OscillatorNode extends AudioScheduledSourceNode {
  readonly frequency: AudioParam;
  readonly detune: AudioParam;
  type: 'sine' | 'square' | 'sawtooth' | 'triangle' | 'custom';
  setPeriodicWave(periodicWave: PeriodicWave): void;
}

export class PeriodicWave {
  constructor(real: Float32Array, imag: Float32Array, constraints?: { disableNormalization?: boolean });
}

export class GainNode extends AudioNode {
  readonly gain: AudioParam;
}

export class StereoPannerNode extends AudioNode {
  readonly pan: AudioParam;
}

export class DelayNode extends AudioNode {
  constructor(context: BaseAudioContext, options?: { maxDelayTime?: number });
  readonly delayTime: AudioParam;
  readonly maxDelayTime: number;
}

export class BiquadFilterNode extends AudioNode {
  readonly frequency: AudioParam;
  readonly detune: AudioParam;
  readonly Q: AudioParam;
  readonly gain: AudioParam;
  type: 'lowpass' | 'highpass' | 'bandpass' | 'lowshelf' | 'highshelf' | 'peaking' | 'notch' | 'allpass';
  getFrequencyResponse(frequencyHz: Float32Array, magResponse: Float32Array, phaseResponse: Float32Array): void;
}

export class WaveShaperNode extends AudioNode {
  curve: Float32Array | null;
  oversample: 'none' | '2x' | '4x';
}

export class IIRFilterNode extends AudioNode {
  getFrequencyResponse(frequencyHz: Float32Array, magResponse: Float32Array, phaseResponse: Float32Array): void;
}

export class ConvolverNode extends AudioNode {
  buffer: AudioBuffer | null;
  normalize: boolean;
}

export class DynamicsCompressorNode extends AudioNode {
  readonly threshold: AudioParam;
  readonly knee: AudioParam;
  readonly ratio: AudioParam;
  readonly attack: AudioParam;
  readonly release: AudioParam;
  readonly reduction: number;
}

export class ChannelSplitterNode extends AudioNode {}
export class ChannelMergerNode extends AudioNode {}

export class AnalyserNode extends AudioNode {
  fftSize: number;
  readonly frequencyBinCount: number;
  minDecibels: number;
  maxDecibels: number;
  smoothingTimeConstant: number;
  getFloatFrequencyData(array: Float32Array): void;
  getByteFrequencyData(array: Uint8Array): void;
  getFloatTimeDomainData(array: Float32Array): void;
  getByteTimeDomainData(array: Uint8Array): void;
}

export class ScriptProcessorNode extends AudioNode {
  readonly bufferSize: number;
  onaudioprocess: ((event: { playbackTime: number; inputBuffer: AudioBuffer; outputBuffer: AudioBuffer }) => void) | null;
}

export class PannerNode extends AudioNode {
  distanceModel: 'inverse' | 'linear' | 'exponential';
  panningModel: 'equalpower' | 'HRTF';
  refDistance: number;
  maxDistance: number;
  rolloffFactor: number;
  coneInnerAngle: number;
  coneOuterAngle: number;
  coneOuterGain: number;
  setPosition(x: number, y: number, z: number): void;
  setOrientation(x: number, y: number, z: number): void;
}

export class AudioListener {
  setPosition(x: number, y: number, z: number): void;
  setOrientation(x: number, y: number, z: number, xUp: number, yUp: number, zUp: number): void;
}

export class AudioWorkletNode extends AudioNode {
  readonly port: MessagePort;
  readonly parameters: Map<string, AudioParam>;
}

export class AudioWorkletProcessor {
  readonly port: MessagePort | null;
  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean;
  static get parameterDescriptors(): Array<{ name: string; defaultValue?: number; automationRate?: 'a-rate' | 'k-rate' }>;
}

export class MediaStreamAudioSourceNode extends AudioNode {
  pushData(channelData: Float32Array | Float32Array[]): void;
}

export class MediaStreamAudioDestinationNode extends AudioNode {
  readonly stream: { read(): Float32Array[] | null; readonly readable: boolean };
}

// Error types
export class InvalidStateError extends Error { readonly name: 'InvalidStateError' }
export class NotSupportedError extends Error { readonly name: 'NotSupportedError' }
export class IndexSizeError extends Error { readonly name: 'IndexSizeError' }
export class InvalidAccessError extends Error { readonly name: 'InvalidAccessError' }
export class EncodingError extends Error { readonly name: 'EncodingError' }

export const BLOCK_SIZE: 128;
