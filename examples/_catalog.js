// Website catalog. This is the single source of truth for the examples index and generated pages.

export const examples = [
  {
    id: 'tone', title: 'Reference tone', category: 'Test signals', job: 'Generate', mode: 'audio', featured: true,
    description: 'Play a reference pitch with selectable waveform and frequency.',
    graph: 'Oscillator → Gain → Destination', input: 'Waveform · frequency', output: 'Speaker audio',
    apis: ['AudioContext', 'OscillatorNode', 'GainNode'], command: 'node examples/tone.js sine A4 2s',
  },
  {
    id: 'sweep', title: 'Frequency sweep', category: 'Test signals', job: 'Measure', mode: 'audio',
    description: 'Sweep across a frequency range with linear or exponential automation.',
    graph: 'Oscillator.frequency automation → Gain → Destination', input: 'Start/end frequency · duration', output: 'Speaker audio',
    apis: ['AudioContext', 'OscillatorNode', 'AudioParam'], command: 'node examples/sweep.js 20..20k exp 3s',
    warning: 'Start at low volume. High frequencies and sudden level changes can be uncomfortable.',
  },
  {
    id: 'noise', title: 'Colored noise', category: 'Test signals', job: 'Generate', mode: 'audio',
    description: 'Generate white, pink, brown, blue, or violet noise.',
    graph: 'Noise source → Gain → Destination', input: 'Noise color', output: 'Speaker audio',
    apis: ['AudioContext', 'AudioBufferSourceNode', 'GainNode'], command: 'node examples/noise.js pink 2s',
    warning: 'Start at low volume; broadband noise carries energy across much of the audible spectrum.',
  },
  {
    id: 'impulse', title: 'Dirac impulse', category: 'Test signals', job: 'Measure', mode: 'audio',
    description: 'Fire a one-sample impulse for response and signal-path testing.',
    graph: 'One-sample AudioBuffer → Destination', input: 'Count · interval', output: 'Impulse clicks',
    apis: ['AudioContext', 'AudioBuffer', 'AudioBufferSourceNode'], command: 'node examples/impulse.js 5 0.5s',
    warning: 'Use low playback volume. An impulse is intentionally abrupt.',
  },
  {
    id: 'dtmf', title: 'DTMF dialer', category: 'Test signals', job: 'Generate', mode: 'audio',
    description: 'Synthesize telephone keypad tones from paired row and column frequencies.',
    graph: '2 Oscillators → Envelope → Destination', input: 'Digits · tone duration', output: 'DTMF audio',
    apis: ['AudioContext', 'OscillatorNode', 'GainNode'], command: 'node examples/dtmf.js 5551234',
  },
  {
    id: 'stereo-test', title: 'Stereo channel test', category: 'Test signals', job: 'Measure', mode: 'audio',
    description: 'Identify left, right, and center channels with a panned reference tone.',
    graph: 'Oscillator → StereoPanner → Envelope → Destination', input: 'Frequency · duration', output: 'Stereo audio',
    apis: ['AudioContext', 'StereoPannerNode', 'GainNode'], command: 'node examples/stereo-test.js 1k 1s',
    warning: 'Start at low volume, especially with headphones.',
  },
  {
    id: 'metronome', title: 'Programmable metronome', category: 'Test signals', job: 'Create', mode: 'audio', featured: true,
    description: 'Schedule a click pattern with accents, rests, tempo control, and instrument presets.',
    graph: 'Scheduled transients → Master Gain → Destination', input: 'Tempo · pattern · sound', output: 'Timed clicks',
    apis: ['AudioContext', 'AudioBufferSourceNode', 'BiquadFilterNode', 'AudioParam'], command: 'node examples/metronome.js 120 X-x-X-x-',
  },
  {
    id: 'tuner', title: 'Microphone tuner', category: 'Test signals', job: 'Analyze', mode: 'mic',
    description: 'Estimate microphone pitch, nearest note, and tuning error in cents.',
    graph: 'Microphone → Analyser → Pitch detector', input: 'Microphone stream', output: 'Pitch · note · cents',
    apis: ['MediaStreamAudioSourceNode', 'AnalyserNode'], command: 'node examples/tuner.js 440',
    warning: 'The browser asks for microphone permission. Audio stays on this device.',
  },

  {
    id: 'shepard', title: 'Shepard tone', category: 'Illusions', job: 'Explore', mode: 'audio',
    description: 'Layer octave-spaced voices to create a pitch that appears to rise or fall forever.',
    graph: 'Octave bank → Gaussian gains → Destination', input: 'Direction · rate', output: 'Pitch illusion',
    apis: ['AudioContext', 'OscillatorNode', 'GainNode'], command: 'node examples/shepard.js up 15s',
  },
  {
    id: 'risset-rhythm', title: 'Risset rhythm', category: 'Illusions', job: 'Explore', mode: 'audio',
    description: 'Layer tempo cycles to create a beat that appears to accelerate or decelerate forever.',
    graph: 'Scheduled click layers → Destination', input: 'Direction · center tempo', output: 'Rhythm illusion',
    apis: ['AudioContext', 'OscillatorNode', 'AudioParam'], command: 'node examples/risset-rhythm.js up 120 20s',
  },
  {
    id: 'binaural-beats', title: 'Binaural beats', category: 'Illusions', job: 'Explore', mode: 'audio',
    description: 'Send nearby frequencies to opposite ears and hear their difference.',
    graph: '2 Oscillators → hard L/R pan → Destination', input: 'Carrier · frequency difference', output: 'Stereo audio',
    apis: ['AudioContext', 'StereoPannerNode'], command: 'node examples/binaural-beats.js 200 10 10s',
    warning: 'Headphones are required for channel isolation. Keep volume low; no health effect is claimed.',
  },
  {
    id: 'missing-fundamental', title: 'Missing fundamental', category: 'Illusions', job: 'Explore', mode: 'audio',
    description: 'Play harmonics 2–6 while omitting the pitch the listener still perceives.',
    graph: 'Harmonic oscillator bank → Gain → Destination', input: 'Implied fundamental', output: 'Harmonic complex',
    apis: ['AudioContext', 'OscillatorNode', 'GainNode'], command: 'node examples/missing-fundamental.js 100 3s',
  },
  {
    id: 'beating', title: 'Acoustic beating', category: 'Illusions', job: 'Explore', mode: 'audio',
    description: 'Hear amplitude beating produced by two nearby frequencies.',
    graph: '2 nearby Oscillators → Gain → Destination', input: 'Carrier · frequency difference', output: 'Beating tone',
    apis: ['AudioContext', 'OscillatorNode'], command: 'node examples/beating.js 440 3 5s',
  },

  {
    id: 'subtractive-synth', title: 'Subtractive synth', category: 'Synthesis', job: 'Create', mode: 'audio', featured: true,
    description: 'Shape a sawtooth oscillator with a resonant low-pass sweep and ADSR envelope.',
    graph: 'Sawtooth → BiquadFilter → ADSR Gain → Destination', input: 'Frequency · note duration', output: 'Synth note',
    apis: ['OscillatorNode', 'BiquadFilterNode', 'AudioParam'], command: 'node examples/subtractive-synth.js -d 5s',
  },
  {
    id: 'additive', title: 'Additive synthesis', category: 'Synthesis', job: 'Create', mode: 'audio',
    description: 'Construct square, saw, and triangle timbres from individual harmonics.',
    graph: 'Harmonic oscillator bank → Gain → Destination', input: 'Wave · fundamental · harmonics', output: 'Synthesized waveform',
    apis: ['AudioContext', 'OscillatorNode', 'GainNode'], command: 'node examples/additive.js square 220 16 3s',
  },
  {
    id: 'fm-synthesis', title: 'FM synthesis', category: 'Synthesis', job: 'Create', mode: 'audio',
    description: 'Use one oscillator to modulate another oscillator’s frequency.',
    graph: 'Modulator → Carrier.frequency → Gain → Destination', input: 'Carrier · ratio · index', output: 'FM timbre',
    apis: ['OscillatorNode', 'AudioParam', 'GainNode'], command: 'node examples/fm-synthesis.js 440 2 5 3s',
  },
  {
    id: 'karplus-strong', title: 'Karplus–Strong string', category: 'Synthesis', job: 'Create', mode: 'audio',
    description: 'Turn a short noise burst and averaging delay into a plucked string.',
    graph: 'Noise ring buffer → feedback average → Destination', input: 'Pitch · decay', output: 'Plucked string',
    apis: ['AudioBuffer', 'AudioBufferSourceNode'], command: 'node examples/karplus-strong.js A4 4s',
  },

  {
    id: 'sequencer', title: 'Step sequencer', category: 'Generative', job: 'Create', mode: 'audio',
    description: 'Schedule a 16-step melody against the audio clock.',
    graph: 'Scheduled Oscillators → envelopes → Destination', input: 'Tempo · pattern', output: 'Timed sequence',
    apis: ['AudioContext', 'OscillatorNode', 'AudioParam'], command: 'node examples/sequencer.js bpm=140 -d 10s',
  },
  {
    id: 'serial', title: 'Twelve-tone generator', category: 'Generative', job: 'Create', mode: 'audio',
    description: 'Generate pointillistic music from prime, retrograde, inverse, and retrograde-inverse rows.',
    graph: 'Row generator → scheduled voices → Destination', input: 'Tempo · duration', output: 'Generative music',
    apis: ['AudioContext', 'OscillatorNode', 'GainNode'], command: 'node examples/serial.js 72 30s',
  },
  {
    id: 'gamelan', title: 'Generative gamelan', category: 'Generative', job: 'Create', mode: 'audio',
    description: 'Schedule interlocking slendro patterns with metalophone partials and gong structure.',
    graph: 'Slendro scheduler → metallic voices → Destination', input: 'Tempo · duration', output: 'Generative music',
    apis: ['AudioContext', 'OscillatorNode', 'AudioParam'], command: 'node examples/gamelan.js 120 20s',
  },
  {
    id: 'drone', title: 'Harmonic drone', category: 'Generative', job: 'Create', mode: 'audio',
    description: 'Layer lightly detuned harmonics into a tanpura-like four-string drone.',
    graph: 'Detuned harmonic banks → Master Gain → Destination', input: 'Base pitch', output: 'Continuous drone',
    apis: ['AudioContext', 'OscillatorNode', 'GainNode'], command: 'node examples/drone.js C3 30s',
  },
  {
    id: 'jazz', title: 'Generative jazz', category: 'Generative', job: 'Create', mode: 'audio',
    description: 'Generate modal harmony, walking bass, plucked improvisation, and percussion.',
    graph: 'Theory generators → instrument chains → Destination', input: 'Seeded choices', output: 'Generative performance',
    apis: ['AudioContext', 'AudioWorkletNode', 'BiquadFilterNode'], command: 'node examples/jazz.js',
  },

  {
    id: 'speaker', title: 'Speaker hello world', category: 'API', job: 'Port', mode: 'audio',
    description: 'Play the smallest useful realtime graph through the system output.',
    graph: 'Oscillator → Gain → Destination', input: 'Duration', output: 'System speakers',
    apis: ['AudioContext', 'AudioDestinationNode'], command: 'node examples/speaker.js',
  },
  {
    id: 'lfo', title: 'LFO tremolo', category: 'API', job: 'Create', mode: 'audio',
    description: 'Connect an oscillator to an AudioParam and modulate gain at audio-clock precision.',
    graph: 'LFO + ConstantSource → Gain.gain ← Carrier', input: 'Rate · depth · waveform', output: 'Tremolo tone',
    apis: ['ConstantSourceNode', 'OscillatorNode', 'AudioParam'], command: 'node examples/lfo.js rate=5 depth=0.5 -d 10s',
  },
  {
    id: 'spatial', title: 'Spatial panning', category: 'API', job: 'Create', mode: 'audio',
    description: 'Move a source from left to right through three-dimensional space.',
    graph: 'Oscillator → Panner → Gain → Destination', input: 'Position curve · duration', output: 'Spatialized audio',
    apis: ['PannerNode', 'AudioListener', 'AudioParam'], command: 'node examples/spatial.js -d 5s',
  },
  {
    id: 'worklet', title: 'Custom AudioWorklet', category: 'API', job: 'Extend', mode: 'worklet',
    description: 'Register a custom processor, expose a parameter, and render its output.',
    graph: 'AudioWorkletProcessor → AudioWorkletNode → Destination', input: 'Processor code · AudioParam', output: 'Custom DSP audio',
    apis: ['AudioWorklet', 'AudioWorkletNode', 'AudioWorkletProcessor'], command: 'node examples/worklet.js',
    note: 'The browser adapter registers a Blob URL. WAA also supports inline callback registration in Node.',
  },
  {
    id: 'linked-params', title: 'Linked AudioParams', category: 'API', job: 'Test', mode: 'offline',
    description: 'Drive multiple gain parameters from one ConstantSourceNode.',
    graph: 'ConstantSource → 2 Gain AudioParams → mix → AudioBuffer', input: 'Shared automation curve', output: 'Offline AudioBuffer',
    apis: ['OfflineAudioContext', 'ConstantSourceNode', 'AudioParam'], command: 'node examples/linked-params.js',
  },
  {
    id: 'fft', title: 'FFT spectrum', category: 'API', job: 'Analyze', mode: 'offline', featured: true,
    description: 'Render a two-tone signal and inspect its frequency-domain peaks.',
    graph: '2 Oscillators → Analyser → AudioBuffer', input: 'Signal · FFT size', output: 'Spectrum bins · peaks',
    apis: ['OfflineAudioContext', 'AnalyserNode'], command: 'node examples/fft.js',
  },
  {
    id: 'render-to-buffer', title: 'Offline render', category: 'API', job: 'Render', mode: 'offline', featured: true,
    description: 'Render a complete graph to an AudioBuffer with no speakers or audio device.',
    graph: 'Offline graph → AudioDestination → AudioBuffer', input: 'Graph · length · sample rate', output: 'AudioBuffer',
    apis: ['OfflineAudioContext', 'AudioBuffer'], command: 'node examples/render-to-buffer.js',
  },
  {
    id: 'process-file', title: 'Process an audio file', category: 'API', job: 'Process', mode: 'file', featured: true,
    description: 'Decode an audio file, apply EQ and compression, then render the processed result.',
    graph: 'File → decode → high-shelf EQ → compressor → AudioBuffer', input: 'Audio file', output: 'Processed AudioBuffer',
    apis: ['decodeAudioData', 'BiquadFilterNode', 'DynamicsCompressorNode'], command: 'node examples/process-file.js input.mp3',
    note: 'The browser preview accepts formats the browser can decode. In Node, WAA uses audio-decode for WAV, MP3, FLAC, OGG, and AAC.',
  },
  {
    id: 'pipe-stdout', title: 'Pipe PCM to stdout', category: 'API', job: 'Stream', mode: 'node', featured: true,
    description: 'Send raw PCM from an AudioContext to any Node writable stream.',
    graph: 'Audio graph → sinkId Writable → aplay/ffmpeg/sox', input: 'Audio graph', output: '16-bit interleaved PCM',
    apis: ['AudioContext', 'AudioDestinationNode', 'WritableStream'], command: 'node examples/pipe-stdout.js | ffplay -f s16le -ar 44100 -ac 2 -',
  },
  {
    id: 'mic', title: 'Microphone level', category: 'API', job: 'Capture', mode: 'mic', featured: true,
    description: 'Route a live microphone through a gain and analyser with an RMS meter.',
    graph: 'Microphone → Gain → Analyser → Destination', input: 'Microphone stream', output: 'Monitored audio · RMS',
    apis: ['MediaStreamAudioSourceNode', 'GainNode', 'AnalyserNode'], command: 'node examples/mic.js gain=0.8',
    warning: 'Use headphones to avoid acoustic feedback. The browser asks for microphone permission.',
    note: 'The browser preview keeps monitoring muted to prevent feedback. The Node CLI can route the graph to speakers.',
  },
  {
    id: 'recorder', title: 'Microphone recorder', category: 'API', job: 'Capture', mode: 'mic',
    description: 'Capture microphone audio with a live level meter and save a recording.',
    graph: 'Microphone → Gain → recorder → file', input: 'Microphone stream', output: 'Recorded audio file',
    apis: ['MediaStreamAudioSourceNode', 'ScriptProcessorNode'], command: 'node examples/recorder.js take1 gain=2',
    warning: 'Use headphones to avoid feedback. The browser asks for microphone permission.',
    note: 'The browser adapter saves the MediaRecorder format it supports. The Node CLI writes PCM WAV.',
  },
]

export const byId = new Map(examples.map(example => [example.id, example]))
export const categories = [...new Set(examples.map(example => example.category))]
export const jobs = [...new Set(examples.map(example => example.job))]
export const featured = examples.filter(example => example.featured)
