// Test runner — imports all test modules
// Run: node test/index.js

// Core infrastructure
import './DspObject.test.js'
import './AudioBuffer.test.js'
import './AudioNode.test.js'
import './audioports.test.js'
import './AudioParam.test.js'
import './AudioContext.test.js'

// Existing nodes
import './GainNode.test.js'
import './AudioBufferSourceNode.test.js'
import './ScriptProcessorNode.test.js'
import './AudioListener.test.js'
import './PannerNode.test.js'

// Phase 2 nodes
import './ConstantSourceNode.test.js'
import './OscillatorNode.test.js'
import './StereoPannerNode.test.js'
import './DelayNode.test.js'
import './BiquadFilterNode.test.js'
import './WaveShaperNode.test.js'
import './IIRFilterNode.test.js'
import './ConvolverNode.test.js'
import './DynamicsCompressorNode.test.js'
import './ChannelNodes.test.js'
import './AnalyserNode.test.js'

// Utilities and misc
import './math.test.js'
import './utils.test.js'
import './audit-fixes.test.js'

// Phase 3
import './OfflineAudioContext.test.js'
import './AudioWorklet.test.js'
import './MediaStreamNodes.test.js'
import './polyfill.test.js'

// Edge cases & validation
import './edge-cases.test.js'
import './spec-compliance.test.js'

// Integration
import './integration.test.js'

// W3C Web Platform Tests
import './wpt.test.js'
