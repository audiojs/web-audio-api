## Current README problems:

"Alternatives" framing is defensive
Missing: offline rendering example, testing use case, clear "when to use this vs alternatives"
What the README should be:

What it is (one line)
Why it matters (runs everywhere)
Proof (WPT conformance)
Install + use (30 seconds to running code)
When to use what (honest comparison)

## BLINDSPOTS — What am I not seeing?

Performance ceiling — Pure JS will always be slower than Rust/native. Is this acknowledged honestly? At what graph complexity does it fall behind real-time? Users need to know.
outStream is non-standard — The one API surface that ISN'T Web Audio spec. It's the escape hatch for output, but it breaks the "it's the same API" promise.
Browser-only WPT tests — Some WPT tests require MediaElement, actual hardware audio output, etc. The ~1% gap isn't laziness, it's a fundamental environment limitation. This should be stated clearly.
Maintenance load — WPT evolves. Browsers update. 99% today requires ongoing effort.
AudioWorklet isolation — In browsers, AudioWorklet runs in a separate thread. In this implementation, it runs synchronously. For most use cases that's fine, but it's a behavioral difference.

## Extra value

Extractable DSP kernels: Each node's _dsp() function is a standalone algorithm — biquad filter, FFT, convolution, dynamics compression. These could become independent modules.
Isomorphic audio: Write audio processing once, run it on client and server. Share audio graph definitions between browser and Node.js.
Audio as function: OfflineAudioContext turns audio processing into a pure function: graph in → buffer out. Perfect for serverless.

## Use cases

0. Speaker output — real-time playback via speaker/stdout
1. Offline rendering — graph in → buffer out (OfflineAudioContext)
2. Audio file processing — decode → effects chain → render
3. Sound synthesis — oscillators + filters + automation → buffer
4. Audio testing — test Web Audio code in CI without a browser
5. Audio analysis — FFT, spectral features, metering
6. Stream processing — real-time effects on audio streams


## Examples (examples/)

  Grounded in MDN tutorials + real npm usage. Each is self-contained, no browser, no DOM.

  The best format is runnable files — they prove the code works. No examples.md intermediary.

  ```
  examples/
    speaker.js        # node examples/speaker.js
    sweep.js           # node examples/sweep.js | aplay -f cd
    process-file.js    # node examples/process-file.js input.mp3 | aplay -f cd
    ...
  ```

  Each file: ~20-30 lines, self-contained, commented header explaining what it does. Output is either raw PCM to stdout (pipe to aplay/sox/ffmpeg) or data to console (analysis examples). The Unix way — composable.

  The files themselves ARE the documentation. An agent reads the file, understands the pattern, copies it. A developer runs it, hears the result.

  The examples in THIS project should be spec patterns, not convenience wrappers. They demonstrate "here's what the Web Audio API can do outside a browser" — not "here's our easier API for audio processing."

  ### Getting started
  - [ ] **speaker.js** — Hello world. AudioContext + Speaker + OscillatorNode.
        Source: README pattern, original project purpose.
  - [ ] **pipe-stdout.js** — Pipe audio to system: `node example.js | aplay -f cd`.
        Source: README pattern.

  ### Offline rendering (the killer feature)
  - [ ] **render-to-buffer.js** — OfflineAudioContext → OscillatorNode → AudioBuffer → write raw PCM.
        The "audio as function" pattern. Graph in → buffer out.
  - [ ] **process-file.js** — readFile → decodeAudioData → BiquadFilter (highpass 80Hz) + DynamicsCompressor → render → write.
        Source: MDN "dial-up" sample loading + real Descript/web-audio-engine usage.

  ### Synthesis (MDN "Advanced techniques" patterns)
  - [ ] **sweep.js** — OscillatorNode + PeriodicWave (custom waveform) + GainNode envelope (attack/release via linearRamp).
        Source: MDN "Advanced techniques" sweep pattern.
  - [ ] **subtractive-synth.js** — Sawtooth → BiquadFilter (lowpass, frequency sweep) → GainNode (ADSR via setValueAtTime + exponentialRamp).
        Source: MDN simple synth keyboard + advanced techniques.
  - [ ] **noise.js** — Procedural AudioBuffer (Math.random white noise) → BiquadFilter (bandpass) → shaped noise.
        Source: MDN "Advanced techniques" noise pattern.
  - [ ] **lfo.js** — Two oscillators: OscillatorNode (sine carrier) + OscillatorNode (square LFO → gain modulation) = tremolo/pulse.
        Source: MDN "Advanced techniques" pulse pattern.

  ### Spatial audio
  - [ ] **spatial.js** — PannerNode (HRTF/equalpower) + AudioListener + positionX automation (source moving L→R) → stereo OfflineAudioContext render.
        Source: MDN "Web audio spatialization basics".

  ### Analysis
  - [ ] **fft.js** — decodeAudioData → AnalyserNode + ScriptProcessorNode → extract getFloatFrequencyData per quantum → print spectrum.
        Source: MDN "Visualizations with Web Audio API", adapted for server-side (no canvas, raw data output).

  ### Advanced
  - [ ] **worklet.js** — AudioWorkletProcessor that generates white noise (simplest custom processor). Register + connect + render.
        Source: MDN "Background audio processing using AudioWorklet".
  - [ ] **linked-params.js** — ConstantSourceNode controlling multiple GainNodes simultaneously (chord with linked volumes).
        Source: MDN "Controlling multiple parameters with ConstantSourceNode".
  - [ ] **sequencer.js** — Multi-voice step sequencer: sweep + noise + sample voices, currentTime-based lookahead scheduling.
        Source: MDN "Advanced techniques" sequencer pattern. Demonstrates precise timing without requestAnimationFrame.

  ### References
  - MDN Web Audio guides: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
  - MDN examples repo: https://github.com/mdn/webaudio-examples/
  - Descript fork (real server-side usage): https://github.com/descriptinc/web-audio-js


## [ ] AI agents + audio: real or fictional?

  Honest answer: the near use case is simpler than you think. Agents already know the Web Audio API from training data (MDN is heavily represented). This project makes that existing knowledge work in CLI. An agent asked to "generate a 440Hz tone" or "apply a lowpass filter to this file" can write standard Web Audio code and run it immediately.

  Concrete contexts where this is real today:

  Agent generates notification/alert sounds — synth a tone, save to file
  Agent preprocesses audio for transcription — highpass filter, normalize
  Agent analyzes audio — "what frequencies are dominant in this file?"
  Agent tests audio code — write Web Audio graph, verify output in CI
  The deeper question — "teach agents to be audio engineers" — is aspirational. That's not about this project, that's about agent capabilities + training data.

  **Agent Skill to remaster your audio**
