import test from 'tst'
import { is, ok, throws } from 'tst'
import { validateFormat } from '../src/utils.js'

// NOTE: decodeAudioData tests moved to Phase 1 (requires audio-decode migration)
// These tests use fs.readFile which is Node-only. Phase 1 will make decoding cross-platform.

test('validateFormat > applies defaults', () => {
  let fmt = validateFormat({ numberOfChannels: 2 })
  is(fmt.bitDepth, 16)
  is(fmt.endianness, 'LE')
  is(fmt.signed, true)
  is(fmt.numberOfChannels, 2)
})

test('validateFormat > rejects invalid bitDepth', () => {
  throws(() => validateFormat({ numberOfChannels: 2, bitDepth: 24 }))
  throws(() => validateFormat({ numberOfChannels: 2, bitDepth: 'x' }))
})

test('validateFormat > rejects missing numberOfChannels', () => {
  throws(() => validateFormat({}))
})

// --- Phase 0 issue tests ---

test('Phase0 > utils > loadWasm is dead code with hardcoded path', () => {
  // Issue #10: loadWasm references './dsp/gain.wasm' hardcoded
  // It's dead code that should be removed
  import('../src/utils.js').then(utils => {
    ok(typeof utils.loadWasm === 'function', 'loadWasm exists')
    throws(() => utils.loadWasm(), undefined, 'loadWasm throws (dead code)')
  })
})

test('Phase0 > utils > BufferEncoder uses deprecated new Buffer()', () => {
  // Issue #6: new Buffer() instead of Buffer.alloc()
  // In newer Node.js, new Buffer() may be removed
  // This test just verifies the encoder still works with current runtime
  import('../src/utils.js').then(utils => {
    let encoder = utils.BufferEncoder({ numberOfChannels: 1, bitDepth: 16 })
    let data = [new Float32Array([0.5, -0.5, 0, 1])]
    let result = encoder(data)
    ok(result.length > 0, 'encoder produces output')
  })
})
