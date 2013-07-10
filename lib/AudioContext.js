var _ = require('underscore')

var AudioContext = function() {

  Object.defineProperty(this, 'currentTime', {
    writable: false,
    get: function() {}
  })

  Object.defineProperty(this, 'destination', {
    writable: false,
    value: {} // TODO
  })

  Object.defineProperty(this, 'sampleRate', {
    writable: false,
    value: {} // TODO
  })

  Object.defineProperty(this, 'listener', {
    writable: false,
    value: {} // TODO
  })

}


_.extend(AudioContext.prototype, {


    AudioBuffer createBuffer(unsigned long numberOfChannels, unsigned long length, float sampleRate);

    AudioBuffer? createBuffer(ArrayBuffer buffer, boolean mixToMono);

    void decodeAudioData(ArrayBuffer audioData,
                         DecodeSuccessCallback successCallback,
                         optional DecodeErrorCallback errorCallback);


    // AudioNode creation 
    AudioBufferSourceNode createBufferSource();

    MediaElementAudioSourceNode createMediaElementSource(HTMLMediaElement mediaElement);

    MediaStreamAudioSourceNode createMediaStreamSource(MediaStream mediaStream);
    MediaStreamAudioDestinationNode createMediaStreamDestination();

    ScriptProcessorNode createScriptProcessor(optional unsigned long bufferSize = 0,
                                              optional unsigned long numberOfInputChannels = 2,
                                              optional unsigned long numberOfOutputChannels = 2);

    AnalyserNode createAnalyser();
    GainNode createGain();
    DelayNode createDelay(optional double maxDelayTime = 1.0);
    BiquadFilterNode createBiquadFilter();
    WaveShaperNode createWaveShaper();
    PannerNode createPanner();
    ConvolverNode createConvolver();

    ChannelSplitterNode createChannelSplitter(optional unsigned long numberOfOutputs = 6);
    ChannelMergerNode createChannelMerger(optional unsigned long numberOfInputs = 6);

    DynamicsCompressorNode createDynamicsCompressor();

    OscillatorNode createOscillator();
    PeriodicWave createPeriodicWave(Float32Array real, Float32Array imag);

})