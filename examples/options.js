// Shared option metadata for the CLI documentation and browser example controls.

const range = (key, syntax, label, value, min, max, step, unit, description) => ({
  key, syntax, label, type: 'range', value, min, max, step, unit, description,
})

const select = (key, syntax, label, value, choices, description) => ({
  key, syntax, label, type: 'select', value, choices, description,
})

const text = (key, syntax, label, value, description, pattern) => ({
  key, syntax, label, type: 'text', value, description, pattern,
})

const cliOnly = (syntax, description) => ({ syntax, description, browser: false })

// An audio file the browser decodes into an AudioBuffer before the graph starts; the CLI reads it from disk
const file = (key, syntax, label, description) => ({ key, syntax, label, type: 'file', accept: 'audio/*', description })

const clickSounds = ['classic', 'wood', 'bell', 'beep', 'signal', 'karatala']

const duration = (value, max = Math.max(10, value)) => range(
  'duration', '-d, --duration <time>', 'Duration', value, 0.5, max, value === 1.75 ? 0.25 : 0.5, 's',
  `run time (CLI accepts s/m/h suffixes; default: ${value}s)`,
)

const frequency = (value = 440, label = 'Frequency', min = 20, max = 20000) => range(
  'frequency', 'freq=<hz|note>', label, value, min, max, 1, 'Hz',
  `frequency or note name in the CLI (default: ${value})`,
)

export const exampleOptions = {
  tone: [
    select('waveform', 'wave=<type>', 'Wave', 'sine', ['sine', 'triangle', 'square', 'sawtooth'], 'sine, triangle, square, or sawtooth'),
    frequency(440, 'Frequency', 20, 20000),
    { ...duration(30, 120), browser: false },
  ],
  sweep: [
    {
      syntax: 'start..end', description: 'frequency range; either endpoint may be omitted (default: 20..20k)',
      controls: [
        range('from', 'start..end', 'Start', 20, 20, 20000, 10, 'Hz'),
        range('to', 'start..end', 'End', 20000, 20, 20000, 100, 'Hz'),
      ],
    },
    select('mode', 'mode=<exp|lin>', 'Curve', 'exponential', ['exponential', 'linear'], 'exponential or linear sweep'),
    duration(3, 30),
  ],
  noise: [
    select('color', 'color=<type>', 'Noise color', 'white', ['white', 'pink', 'brown', 'blue', 'violet'], 'white, pink, brown, blue, or violet'),
    { ...duration(30, 120), browser: false },
  ],
  impulse: [
    range('count', 'count=<number>', 'Impulses', 1, 1, 8, 1, '', 'number of scheduled impulses'),
    range('interval', 'interval=<time>', 'Interval', 0.5, 0.1, 2, 0.1, 's', 'gap between impulses'),
  ],
  dtmf: [
    text('digits', 'digits=<sequence>', 'Digits', '5551234', 'digits to dial; supports 0–9, *, #, and A–D', '[0-9*#A-Da-d]+'),
    range('speed', 'speed=<time>', 'Tone length', 0.12, 0.08, 0.3, 0.01, 's', 'length of each tone and following gap'),
  ],
  'stereo-test': [
    frequency(1000, 'Frequency', 100, 4000),
    { ...duration(1, 5), key: 'durationPerChannel', label: 'Time per channel', browser: false },
  ],
  metronome: [
    text('bpm', 'bpm=<bpm|start..end>', 'Tempo', '80..240', 'fixed tempo or a linear tempo ramp'),
    { ...duration(600, 600), browserValue: 30, browser: false },
    text('pattern', 'pat=<pattern>', 'Pattern', 'X-x-x-x-', 'X accent, x hit, - or . rest', '[Xx.-]+'),
    select('sound', 'sound=<preset>', 'Sound', 'classic', clickSounds, 'classic, wood, bell, beep, signal, or karatala'),
    range('hi', 'hi=<hz>', 'Accent resonance', 1900, 200, 4000, 10, 'Hz', 'classic stick accent resonance'),
    range('lo', 'lo=<hz>', 'Regular resonance', 1250, 200, 4000, 10, 'Hz', 'classic stick regular resonance'),
    file('sample', 'sample=<file>', 'Sample', 'audio file to use as the click sound instead of a preset'),
  ],
  tuner: [
    range('a4', 'a=<hz>', 'A4 reference', 440, 400, 480, 1, 'Hz', 'reference pitch for A4'),
    cliOnly('rate=<hz>', 'microphone sample rate (default: 44100)'),
    cliOnly('ch=<number>', 'input channels (default: 1)'),
    cliOnly('bit=<number>', 'input PCM bit depth (default: 16)'),
    cliOnly('backend=<name>', '@audio/mic backend: miniaudio/auto or process'),
  ],
  'latency-tester': [
    range('interval', 'interval=<s>', 'Click interval', 1.5, 0.6, 4, 0.1, 's', 'time between test clicks'),
    cliOnly('rate=<hz>', 'microphone sample rate (default: 44100)'),
    cliOnly('ch=<number>', 'input channels (default: 1)'),
    cliOnly('bit=<number>', 'input PCM bit depth (default: 16)'),
    cliOnly('backend=<name>', '@audio/mic backend: miniaudio/auto or process'),
  ],
  'level-meter': [
    select('ballistics', 'ballistics=<fast|slow>', 'Ballistics', 'slow', ['fast', 'slow'], 'meter response speed'),
    range('gain', 'gain=<number>', 'Input gain', 1, 0, 4, 0.05, '×', 'input gain'),
    cliOnly('rate=<hz>', 'sample rate (default: 44100)'),
    cliOnly('ch=<number>', 'input channels (default: 1)'),
    cliOnly('bit=<number>', 'input PCM bit depth (default: 16)'),
    cliOnly('backend=<name>', '@audio/mic backend: miniaudio/auto or process'),
  ],
  shepard: [
    select('direction', 'dir=<up|down>', 'Direction', 'up', ['up', 'down'], 'movement direction'),
    select('wave', 'wave=<type>', 'Wave', 'sine', ['sine', 'triangle', 'square', 'sawtooth'], 'sine, triangle, square, or sawtooth'),
    range('rate', 'rate=<octaves/s>', 'Rate', 0.5, 0.1, 10, 0.1, 'oct/s', 'movement speed'),
    { ...duration(30, 120), browser: false },
  ],
  'risset-rhythm': [
    select('direction', 'dir=<up|down>', 'Direction', 'up', ['up', 'down'], 'movement direction'),
    range('bpm', 'bpm=<number>', 'Center tempo', 120, 40, 240, 1, 'BPM', 'center tempo'),
    { ...duration(20, 120), browser: false },
    select('sound', 'sound=<preset>', 'Sound', 'click', ['click', ...clickSounds], 'click (default) or a metronome preset: classic, wood, bell, beep, signal, karatala'),
    file('sample', 'sample=<file>', 'Sample', 'use an audio file as the click sound instead of a preset'),
  ],
  'binaural-beats': [
    frequency(200, 'Carrier', 40, 1000),
    range('difference', 'beat=<hz>', 'Difference', 10, 0.5, 40, 0.5, 'Hz', 'right-ear frequency offset'),
    { ...duration(60, 180), browser: false },
  ],
  'missing-fundamental': [
    frequency(100, 'Implied pitch', 40, 400),
    select('fundamental', 'fund=<on|off>', 'Fundamental', 'off', ['off', 'on'], 'include the fundamental for comparison'),
    { ...duration(3, 30), browser: false },
  ],
  beating: [
    frequency(440, 'Carrier', 40, 2000),
    range('difference', 'diff=<hz>', 'Difference', 3, 0.5, 40, 0.5, 'Hz', 'difference and beat frequency'),
    { ...duration(30, 120), browser: false },
  ],
  'octave-illusion': [
    { ...frequency(400, 'Low', 100, 1000), key: 'low', syntax: 'low=<hz|note>' },
    { ...frequency(800, 'High', 200, 2000), key: 'high', syntax: 'high=<hz|note>' },
    range('rate', 'rate=<hz>', 'Rate', 2, 0.5, 8, 0.25, 'Hz', 'alternation rate'),
    { ...duration(12, 60), browser: false },
  ],
  'scale-illusion': [
    range('tempo', 'tempo=<bpm>', 'Tempo', 200, 60, 400, 5, 'BPM', 'scale note tempo'),
    { ...frequency(261.63, 'Root', 80, 800), key: 'root', syntax: 'root=<hz|note>' },
    { ...duration(8, 60), browser: false },
  ],
  'tritone-paradox': [
    range('root', 'root=<0-11>', 'Root pitch class', 0, 0, 11, 1, '', 'pitch class 0=C .. 11=B'),
    range('pairs', 'pairs=<n>', 'Pairs', 8, 2, 20, 1, '', 'number of tone pairs'),
    range('rate', 'rate=<hz>', 'Rate', 1.2, 0.3, 3, 0.1, 'Hz', 'tones per second'),
  ],
  continuity: [
    frequency(440, 'Tone', 100, 2000),
    range('gaprate', 'gaprate=<hz>', 'Gap rate', 0.6, 0.2, 3, 0.1, 'Hz', 'gaps per second'),
    select('noise', 'noise=<on|off>', 'Noise fill', 'on', ['on', 'off'], 'fill gaps with masking noise or leave them silent'),
    { ...duration(15, 60), browser: false },
  ],
  streaming: [
    range('tempo', 'tempo=<bpm>', 'Tempo', 240, 60, 600, 10, 'BPM', 'note tempo'),
    range('interval', 'interval=<semitones>', 'Interval', 4, 1, 24, 1, 'st', 'pitch interval between high and low tone'),
    { ...duration(15, 60), browser: false },
  ],
  'huggins-pitch': [
    range('frequency', 'freq=<hz>', 'Target', 600, 200, 2000, 10, 'Hz', 'target frequency'),
    { ...duration(20, 60), browser: false },
  ],
  'zwicker-tone': [
    range('frequency', 'freq=<hz>', 'Notch', 2000, 500, 6000, 50, 'Hz', 'notch center frequency'),
    range('on', 'on=<s>', 'On time', 3, 0.5, 8, 0.5, 's', 'noise-on duration'),
    range('off', 'off=<s>', 'Off time', 2, 0.5, 8, 0.5, 's', 'silence duration'),
    { ...duration(20, 60), browser: false },
  ],
  'subtractive-synth': [
    frequency(220, 'Frequency', 40, 2000),
    range('cutoff', 'cutoff=<hz>', 'Cutoff peak', 3600, 300, 8000, 50, 'Hz', 'filter sweep peak frequency'),
    range('resonance', 'q=<number>', 'Resonance', 8, 0.5, 24, 0.5, '', 'filter Q'),
    { ...duration(2, 10), browser: false },
  ],
  additive: [
    select('waveform', 'wave=<type>', 'Shape', 'square', ['square', 'saw', 'triangle'], 'square, saw, or triangle'),
    frequency(220, 'Fundamental', 40, 2000),
    range('harmonics', 'n=<number>', 'Harmonics', 16, 1, 64, 1, '', 'number of harmonics'),
    { ...duration(3, 30), browser: false },
  ],
  'fm-synthesis': [
    { ...frequency(440, 'Carrier', 40, 2000), key: 'carrier', syntax: 'carrier=<hz|note>' },
    range('ratio', 'ratio=<number>', 'Ratio', 2, 0.5, 12, 0.5, '', 'modulator/carrier frequency ratio'),
    range('index', 'index=<number>', 'Index', 5, 0, 20, 0.5, '', 'modulation index'),
    { ...duration(30, 120), browser: false },
  ],
  'karplus-strong': [
    frequency(220, 'Pitch', 40, 2000),
    range('decay', 'decay=<s>', 'Decay', 4, 0.5, 12, 0.5, 's', 'time for the pluck to fade 60 dB'),
    { ...duration(30, 120), browser: false },
  ],
  wavetable: [
    select('preset', 'preset=<name>', 'Preset', 'organ', ['organ', 'bell', 'pulse', 'voice'], 'organ, bell, pulse, or voice'),
    frequency(220, 'Frequency', 40, 2000),
    range('morph', 'morph=<0..1>', 'Morph', 0.3, 0, 1, 0.05, '', 'crossfade toward the next preset'),
    { ...duration(6, 30), browser: false },
  ],
  granular: [
    range('size', 'size=<s>', 'Grain size', 0.08, 0.01, 0.3, 0.01, 's', 'grain length'),
    range('density', 'density=<hz>', 'Density', 15, 2, 60, 1, 'Hz', 'grains per second'),
    range('spread', 'spread=<semitones>', 'Pitch spread', 4, 0, 24, 1, 'st', 'random pitch jitter range'),
    { ...duration(10, 60), browser: false },
  ],
  sequencer: [
    range('bpm', 'bpm=<number>', 'Tempo', 140, 40, 300, 1, 'BPM', 'tempo'),
    text('pattern', 'pat=<steps>', 'Pattern', 'A4,-,C5,-,D5,-,E5,-,D5,C5,A4,-,E4,-,A4,-', 'comma-separated note names, - or . rests', '[A-Ga-g#b0-9,. -]+'),
    { ...duration(1.75, 30), browser: false },
  ],
  serial: [
    range('tempo', 'tempo=<bpm>', 'Tempo', 72, 30, 240, 1, 'BPM', 'approximate tempo'),
    { ...duration(30, 120), browser: false },
  ],
  gamelan: [
    range('tempo', 'tempo=<bpm>', 'Tempo', 120, 40, 300, 1, 'BPM', 'tempo'),
    { ...duration(20, 120), browser: false },
  ],
  drone: [
    select('voice', 'voice=<type>', 'Voice', 'tanpura', ['tanpura', 'pad', 'shruti', 'harmonic'], 'tanpura, pad, shruti, or harmonic'),
    frequency(130.81, 'Sa', 40, 500),
    { ...duration(300, 600), browser: false },
  ],
  jazz: [
    range('bpm', 'bpm=<number>', 'Tempo', 84, 60, 140, 1, 'BPM', 'performance tempo (default: random 76..92)'),
    { ...duration(270, 600), browser: false },
  ],
  euclidean: [
    range('tempo', 'tempo=<bpm>', 'Tempo', 120, 40, 300, 1, 'BPM', 'step tempo'),
    range('steps', 'steps=<n>', 'Steps', 16, 4, 32, 1, '', 'steps per cycle'),
    text('pulses', 'pulses=<n,n,n>', 'Pulses', '3,5,7', 'pulses per voice, comma-separated', '\\d+(,\\d+){0,2}'),
    { ...duration(20, 120), browser: false },
  ],
  speaker: [{ ...duration(2, 10), browser: false }],
  lfo: [
    range('rate', 'rate=<hz>', 'LFO rate', 5, 0.5, 20, 0.5, 'Hz', 'LFO frequency'),
    range('depth', 'depth=<0..1>', 'Depth', 0.5, 0, 1, 0.05, '', 'tremolo depth'),
    select('waveform', 'wave=<type>', 'LFO wave', 'square', ['sine', 'square', 'triangle', 'sawtooth'], 'sine, square, triangle, or sawtooth'),
    { ...duration(30, 120), browser: false },
  ],
  spatial: [{ ...duration(3, 10), browser: false }],
  worklet: [
    range('gain', 'gain=<0..1>', 'Amplitude', 0.18, 0, 1, 0.01, '', 'peak of the amplitude parameter automation'),
  ],
  'linked-params': [],
  fft: [
    range('f1', 'f1=<hz>', 'Tone 1', 440, 20, 8000, 10, 'Hz', 'first tone'),
    range('f2', 'f2=<hz>', 'Tone 2', 880, 20, 8000, 10, 'Hz', 'second tone'),
    select('fftSize', 'fft=<size>', 'FFT size', '2048', ['512', '1024', '2048', '4096', '8192'], 'analyser resolution'),
  ],
  'render-to-buffer': [],
  'process-file': [
    cliOnly('audio-file', 'path to an audio file supported by decodeAudioData()'),
    range('highShelfGain', 'shelf=<db>', 'High shelf', -6, -15, 15, 0.5, 'dB', 'high-shelf gain above 4 kHz'),
    range('threshold', 'threshold=<db>', 'Threshold', -20, -60, 0, 1, 'dB', 'compressor threshold'),
  ],
  'pipe-stdout': [],
  mic: [
    range('gain', 'gain=<number>', 'Input gain', 1, 0, 4, 0.05, '×', 'input gain'),
    cliOnly('rate=<hz>', 'sample rate (default: 44100)'),
    cliOnly('ch=<number>', 'input channels (default: 1)'),
    cliOnly('bit=<number>', 'input PCM bit depth (default: 16)'),
    cliOnly('backend=<name>', '@audio/mic backend: miniaudio/auto or process'),
  ],
  recorder: [
    text('filename', 'filename', 'Filename', 'recording', 'suggested output name'),
    range('gain', 'gain=<number>', 'Input gain', 1, 0, 8, 0.05, '×', 'input gain'),
    cliOnly('rate=<hz>', 'sample rate (default: 44100)'),
    cliOnly('ch=<number>', 'input channels (default: 1)'),
    cliOnly('bit=<number>', 'PCM bit depth (default: 16)'),
    cliOnly('backend=<name>', '@audio/mic backend: miniaudio/auto or process'),
  ],
  reverb: [
    range('decay', 'decay=<s>', 'Decay', 2, 0.2, 6, 0.1, 's', 'impulse response decay time'),
    range('wet', 'wet=<0..1>', 'Wet', 0.35, 0, 1, 0.05, '', 'wet/dry mix'),
    { ...duration(3, 15), browser: false },
  ],
}

export function optionsFor(id) {
  return exampleOptions[id] || []
}

export function controlsFor(id) {
  return optionsFor(id).flatMap(option => option.browser === false ? [] : option.controls || [option])
}
