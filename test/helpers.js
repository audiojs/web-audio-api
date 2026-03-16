import { is, almost } from 'tst'

const EPS = 1e-4

// assert every element in typed array / array approximately equals val
export const allAlmost = (arr, val, eps = EPS) => {
  for (let i = 0; i < arr.length; i++) almost(arr[i], val, eps, `arr[${i}] ≈ ${val}`)
}

// assert every element matches a time-varying function
export const allFunc = (block, Tb, fn, Ts = 1 / 44100) => {
  let t = Tb
  for (let i = 0; i < block.length; i++) {
    almost(block[i], fn(t, Tb), EPS, `f(${t}) ≈ ${fn(t, Tb)}`)
    t += Ts
  }
}

// assert every element exactly equals val
export const allEqual = (arr, val) => {
  for (let i = 0; i < arr.length; i++) is(arr[i], val, `arr[${i}] = ${val}`)
}

// assert buffer has expected channels with all-same values
export const channelsEqual = (buf, values) => {
  is(buf.numberOfChannels, values.length, 'channel count')
  for (let ch = 0; ch < values.length; ch++)
    allAlmost(buf.getChannelData(ch), values[ch])
}

// helper: create output port that returns buffer with given channel values
export const makeOutput = (AudioOutput, AudioBuffer, ctx, values) => {
  let out = new AudioOutput(ctx, { channelCount: values.length }, 0)
  let arr = values.map(v => {
    let a = new Float32Array(128)
    a.fill(v)
    return a
  })
  out._tick = () => AudioBuffer.fromArray(arr, 44100)
  return out
}
