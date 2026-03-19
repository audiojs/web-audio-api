import AudioNode from './AudioNode.js'
import AudioBuffer from 'audio-buffer'
import { BLOCK_SIZE } from './constants.js'
import { DOMErr } from './errors.js'
import { cfft, cifft } from 'fourier-transform'

function nextPow2(n) { let p = 1; while (p < n) p <<= 1; return p }

class ConvolverNode extends AudioNode {

  #buffer = null
  #normalize = true
  #irChannels = null
  #convState = null

  get buffer() { return this.#buffer }
  set buffer(val) {
    if (val !== null && val !== undefined) {
      let nch = val.numberOfChannels
      if (nch < 1 || nch > 4 || nch === 3)
        throw DOMErr('ConvolverNode buffer must have 1, 2, or 4 channels', 'NotSupportedError')
      if (val.sampleRate !== this.context.sampleRate)
        throw DOMErr('ConvolverNode buffer sampleRate must match context sampleRate', 'NotSupportedError')
    }
    this.#buffer = val
    this.#convState = null
    if (val) {
      let nch = val.numberOfChannels
      this.#irChannels = []
      for (let c = 0; c < nch; c++) {
        this.#irChannels.push(new Float32Array(val.getChannelData(c)))
      }
      if (this.#normalize) this.#applyNormalization()
    } else {
      this.#irChannels = null
    }
  }

  #applyNormalization() {
    if (!this.#irChannels) return
    let irLen = this.#irChannels[0].length
    let nch = this.#irChannels.length
    let sum = 0
    for (let c = 0; c < nch; c++) {
      let data = this.#irChannels[c]
      for (let i = 0; i < irLen; i++) sum += data[i] * data[i]
    }
    if (sum > 0) {
      let scale = 1 / Math.sqrt(sum)
      for (let c = 0; c < nch; c++) {
        let data = this.#irChannels[c]
        for (let i = 0; i < irLen; i++) data[i] *= scale
      }
    }
  }

  get normalize() { return this.#normalize }
  set normalize(val) {
    val = !!val
    if (this.#normalize === val) return
    this.#normalize = val
    if (this.#buffer) this.buffer = this.#buffer
  }

  constructor(context, options) {
    options = AudioNode._checkOpts(options)
    super(context, 1, 1, undefined, 'clamped-max', 'speakers')
    if (options.disableNormalization !== undefined) this.normalize = !options.disableNormalization
    if (options.buffer !== undefined) this.buffer = options.buffer
    this._outBuf = null
    this._outCh = 0
    this._applyOpts(options)
  }

  _validateChannelCount(val) {
    if (val > 2) throw DOMErr('channelCount cannot be greater than 2', 'NotSupportedError')
  }

  _validateChannelCountMode(val) {
    if (val === 'max') throw DOMErr("channelCountMode cannot be 'max'", 'NotSupportedError')
  }

  #initConvState(convPairs) {
    let irLen = this.#irChannels[0].length
    let segLen = BLOCK_SIZE
    let fftSize = nextPow2(segLen + BLOCK_SIZE)
    let numSegs = Math.ceil(irLen / segLen)

    let pairStates = convPairs.map(([inIdx, irIdx, outIdx]) => {
      let irData = this.#irChannels[irIdx]

      let segFFTs = []
      for (let s = 0; s < numSegs; s++) {
        let re = new Float64Array(fftSize)
        let im = new Float64Array(fftSize)
        let off = s * segLen
        let end = Math.min(off + segLen, irData.length)
        for (let i = off; i < end; i++) re[i - off] = irData[i]
        cfft(re, im)
        segFFTs.push({ re, im })
      }

      return {
        inIdx, outIdx, segFFTs,
        inputFFTs: Array.from({ length: numSegs }, () => ({
          re: new Float64Array(fftSize),
          im: new Float64Array(fftSize)
        })),
        inputPos: 0,
        tail: new Float64Array(fftSize - BLOCK_SIZE)
      }
    })

    // Pre-allocate product buffers (reused per pair each quantum)
    let prodRe = new Float64Array(fftSize)
    let prodIm = new Float64Array(fftSize)

    return { fftSize, numSegs, pairStates, prodRe, prodIm }
  }

  _tick() {
    super._tick()
    let inBuf = this._inputs[0]._tick()

    if (!this.#irChannels) {
      return inBuf
    }

    let irCh = this.#irChannels.length
    let inCh = inBuf.numberOfChannels

    // Per W3C spec, determine output channels and convolution routing.
    // convPairs: [inputChannelIdx, irChannelIdx, outputChannelIdx]
    // For 1-ch IR: each input channel is convolved independently with IR[0]
    // For 2-ch IR: input is upmixed to stereo; L*IR[0]->outL, R*IR[1]->outR
    // For 4-ch IR (true stereo): input upmixed to stereo;
    //   outL = L*IR[0] + R*IR[2], outR = L*IR[1] + R*IR[3]
    let outCh, convPairs
    if (irCh === 1) {
      // Each input channel independently convolved with mono IR
      outCh = inCh
      convPairs = []
      for (let c = 0; c < inCh; c++) convPairs.push([c, 0, c])
    } else if (irCh === 2) {
      outCh = 2
      convPairs = [[0, 0, 0], [1, 1, 1]]
    } else {
      outCh = 2
      convPairs = [[0, 0, 0], [0, 1, 1], [1, 2, 0], [1, 3, 1]]
    }

    if (outCh !== this._outCh) {
      this._outBuf = new AudioBuffer(outCh, BLOCK_SIZE, this.context.sampleRate)
      this._outCh = outCh
      // Don't reset convState — grow/shrink pairStates to match new convPairs
      // This preserves FFT overlap tails across channel count transitions
    }

    // For stereo/4-ch IR, get stereo input (upmixing mono if needed)
    let stereoIn = null
    if (irCh >= 2 && inCh === 1) {
      stereoIn = [inBuf.getChannelData(0), inBuf.getChannelData(0)]
    } else if (irCh >= 2 && inCh >= 2) {
      stereoIn = [inBuf.getChannelData(0), inBuf.getChannelData(1)]
    }

    if (!this.#convState) {
      this.#convState = this.#initConvState(convPairs)
    } else if (this.#convState.pairStates.length !== convPairs.length) {
      // Channel count changed — grow or shrink pair states while preserving existing
      let existing = this.#convState.pairStates
      let fresh = this.#initConvState(convPairs)
      // Preserve overlap tails from existing pairs that match
      for (let i = 0; i < Math.min(existing.length, fresh.pairStates.length); i++) {
        fresh.pairStates[i].tail.set(existing[i].tail)
        fresh.pairStates[i].inputPos = existing[i].inputPos
        for (let s = 0; s < existing[i].inputFFTs.length; s++) {
          fresh.pairStates[i].inputFFTs[s].re.set(existing[i].inputFFTs[s].re)
          fresh.pairStates[i].inputFFTs[s].im.set(existing[i].inputFFTs[s].im)
        }
      }
      // For 1-ch IR growing from fewer to more pairs in speakers mode:
      // copy mono pair state to new pairs. When mono is upmixed to stereo
      // (speakers interpretation), the mono tail appears in all channels.
      // In discrete mode, upmixed channels are zero — no tail copy needed.
      if (irCh === 1 && this.channelInterpretation === 'speakers'
          && existing.length < fresh.pairStates.length && existing.length > 0) {
        let src = fresh.pairStates[0]
        for (let i = existing.length; i < fresh.pairStates.length; i++) {
          fresh.pairStates[i].tail.set(src.tail)
          fresh.pairStates[i].inputPos = src.inputPos
          for (let s = 0; s < src.inputFFTs.length; s++) {
            fresh.pairStates[i].inputFFTs[s].re.set(src.inputFFTs[s].re)
            fresh.pairStates[i].inputFFTs[s].im.set(src.inputFFTs[s].im)
          }
        }
      }
      this.#convState = fresh
    }

    let { fftSize, numSegs, pairStates, prodRe, prodIm } = this.#convState

    for (let c = 0; c < outCh; c++) {
      this._outBuf.getChannelData(c).fill(0)
    }

    for (let ci = 0; ci < pairStates.length; ci++) {
      let ps = pairStates[ci]

      let inp
      if (irCh === 1) {
        // 1-ch IR: each channel convolved independently
        inp = inBuf.getChannelData(ps.inIdx)
      } else {
        inp = stereoIn[ps.inIdx]
      }

      let curFFT = ps.inputFFTs[ps.inputPos]
      curFFT.re.fill(0)
      curFFT.im.fill(0)
      for (let i = 0; i < BLOCK_SIZE; i++) curFFT.re[i] = inp[i]
      cfft(curFFT.re, curFFT.im)

      // Frequency-domain multiply-accumulate using float32 products
      // to match hardware FFT rounding behavior
      let f = Math.fround
      prodRe.fill(0)
      prodIm.fill(0)

      for (let s = 0; s < numSegs; s++) {
        let idx = ((ps.inputPos - s) % numSegs + numSegs) % numSegs
        let inFFT = ps.inputFFTs[idx]
        let irFFT = ps.segFFTs[s]
        for (let k = 0; k < fftSize; k++) {
          prodRe[k] += f(inFFT.re[k] * irFFT.re[k]) - f(inFFT.im[k] * irFFT.im[k])
          prodIm[k] += f(inFFT.re[k] * irFFT.im[k]) + f(inFFT.im[k] * irFFT.re[k])
        }
      }

      cifft(prodRe, prodIm)

      // Write output through Float32Array to introduce float32 quantization
      // (matches browser behavior where audio data is float32)
      let out = this._outBuf.getChannelData(ps.outIdx)
      let tailLen = fftSize - BLOCK_SIZE
      for (let i = 0; i < BLOCK_SIZE; i++) {
        out[i] = Math.fround(out[i] + Math.fround(prodRe[i] + ps.tail[i]))
      }

      for (let i = 0; i < tailLen; i++) {
        ps.tail[i] = prodRe[BLOCK_SIZE + i]
      }

      ps.inputPos = (ps.inputPos + 1) % numSegs
    }

    return this._outBuf
  }
}

export default ConvolverNode
