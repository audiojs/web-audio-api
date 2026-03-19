import test from 'tst'
import { is } from 'tst'
import AudioListener from '../src/AudioListener.js'
import AudioContext from '../src/AudioContext.js'

test('AudioListener > constructor defaults', () => {
  let ctx = new AudioContext()
  let l = ctx.listener
  let pos = l.position
  is(pos.x, 0); is(pos.y, 0); is(pos.z, 0)
  let ori = l.orientation
  is(ori.x, 0); is(ori.y, 0); is(ori.z, -1)
  let up = l.upVector
  is(up.x, 0); is(up.y, 1); is(up.z, 0)
})

test('AudioListener > setPosition', () => {
  let ctx = new AudioContext()
  let l = ctx.listener
  l.setPosition(1, 2, 3)
  let pos = l.position
  is(pos.x, 1); is(pos.y, 2); is(pos.z, 3)
})

test('AudioListener > setOrientation', () => {
  let ctx = new AudioContext()
  let l = ctx.listener
  l.setOrientation(1, 0, 0, 0, 0, 1)
  let ori = l.orientation
  is(ori.x, 1); is(ori.y, 0); is(ori.z, 0)
  let up = l.upVector
  is(up.x, 0); is(up.y, 0); is(up.z, 1)
})

test('AudioListener > AudioParam properties', () => {
  let ctx = new AudioContext()
  let l = ctx.listener
  is(l.positionX.value, 0)
  is(l.positionY.value, 0)
  is(l.positionZ.value, 0)
  is(l.forwardX.value, 0)
  is(l.forwardY.value, 0)
  is(l.forwardZ.value, -1)
  is(l.upX.value, 0)
  is(l.upY.value, 1)
  is(l.upZ.value, 0)
})
