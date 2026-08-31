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
    duration(30, 120),
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
    duration(30, 120),
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
    { ...duration(1, 5), key: 'durationPerChannel', label: 'Time per channel' },
  ],
  metronome: [
    text('bpm', 'bpm=<bpm|start..end>', 'Tempo', '80..240', 'fixed tempo or a linear tempo ramp'),
    { ...duration(600, 600), browserValue: 30 },
    text('pattern', 'pat=<pattern>', 'Pattern', 'X-x-x-x-', 'X accent, x hit, - or . rest', '[Xx.-]+'),
    select('sound', 'sound=<preset>', 'Sound', 'classic', ['classic', 'wood', 'bell', 'beep', 'signal'], 'classic, wood, bell, beep, or signal'),
    range('hi', 'hi=<hz>', 'Accent resonance', 1900, 200, 4000, 10, 'Hz', 'classic stick accent resonance'),
    range('lo', 'lo=<hz>', 'Regular resonance', 1250, 200, 4000, 10, 'Hz', 'classic stick regular resonance'),
  ],
  tuner: [
    range('a4', 'a=<hz>', 'A4 reference', 432, 400, 480, 1, 'Hz', 'reference pitch for A4'),
    cliOnly('rate=<hz>', 'microphone sample rate (default: 44100)'),
    cliOnly('ch=<number>', 'input channels (default: 1)'),
    cliOnly('bit=<number>', 'input PCM bit depth (default: 16)'),
    cliOnly('backend=<name>', '@audio/mic backend: miniaudio/auto or process'),
  ],
  shepard: [
    select('direction', 'dir=<up|down>', 'Direction', 'up', ['up', 'down'], 'movement direction'),
    range('rate', 'rate=<octaves/s>', 'Rate', 0.5, 0.1, 1.5, 0.1, 'oct/s', 'movement speed'),
    duration(30, 120),
  ],
  'risset-rhythm': [
    select('direction', 'dir=<up|down>', 'Direction', 'up', ['up', 'down'], 'movement direction'),
    range('bpm', 'bpm=<number>', 'Center tempo', 120, 40, 240, 1, 'BPM', 'center tempo'),
    duration(20, 120),
  ],
  'binaural-beats': [
    frequency(200, 'Carrier', 40, 1000),
    range('difference', 'beat=<hz>', 'Difference', 10, 0.5, 40, 0.5, 'Hz', 'right-ear frequency offset'),
    duration(60, 180),
  ],
  'missing-fundamental': [frequency(100, 'Implied pitch', 40, 400), duration(3, 30)],
  beating: [
    frequency(440, 'Carrier', 40, 2000),
    range('difference', 'diff=<hz>', 'Difference', 3, 0.5, 40, 0.5, 'Hz', 'difference and beat frequency'),
    duration(30, 120),
  ],
  'subtractive-synth': [duration(2, 10)],
  additive: [
    select('waveform', 'wave=<type>', 'Shape', 'square', ['square', 'saw', 'triangle'], 'square, saw, or triangle'),
    frequency(220, 'Fundamental', 40, 2000),
    range('harmonics', 'n=<number>', 'Harmonics', 16, 1, 64, 1, '', 'number of harmonics'),
    duration(3, 30),
  ],
  'fm-synthesis': [
    { ...frequency(440, 'Carrier', 40, 2000), key: 'carrier', syntax: 'carrier=<hz|note>' },
    range('ratio', 'ratio=<number>', 'Ratio', 2, 0.5, 12, 0.5, '', 'modulator/carrier frequency ratio'),
    range('index', 'index=<number>', 'Index', 5, 0, 20, 0.5, '', 'modulation index'),
    duration(30, 120),
  ],
  'karplus-strong': [frequency(220, 'Pitch', 40, 2000), duration(30, 120)],
  sequencer: [
    range('bpm', 'bpm=<number>', 'Tempo', 140, 40, 300, 1, 'BPM', 'tempo'),
    duration(1.75, 30),
  ],
  serial: [
    range('tempo', 'tempo=<bpm>', 'Tempo', 72, 30, 240, 1, 'BPM', 'approximate tempo'),
    duration(30, 120),
  ],
  gamelan: [
    range('tempo', 'tempo=<bpm>', 'Tempo', 120, 40, 300, 1, 'BPM', 'tempo'),
    duration(20, 120),
  ],
  drone: [frequency(130.81, 'Sa', 40, 500), duration(300, 600)],
  jazz: [],
  speaker: [duration(2, 10)],
  lfo: [
    range('rate', 'rate=<hz>', 'LFO rate', 5, 0.5, 20, 0.5, 'Hz', 'LFO frequency'),
    range('depth', 'depth=<0..1>', 'Depth', 0.5, 0, 1, 0.05, '', 'tremolo depth'),
    select('waveform', 'wave=<type>', 'LFO wave', 'square', ['sine', 'square', 'triangle', 'sawtooth'], 'sine, square, triangle, or sawtooth'),
    duration(30, 120),
  ],
  spatial: [duration(3, 10)],
  worklet: [],
  'linked-params': [],
  fft: [],
  'render-to-buffer': [],
  'process-file': [cliOnly('audio-file', 'path to an audio file supported by decodeAudioData()')],
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
}

export function optionsFor(id) {
  return exampleOptions[id] || []
}

export function controlsFor(id) {
  return optionsFor(id).flatMap(option => option.browser === false ? [] : option.controls || [option])
}
