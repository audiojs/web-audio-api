import test from 'tst'
import { is } from 'tst'
import AudioListener from '../src/AudioListener.js'
import AudioContext from '../src/AudioContext.js'

test('AudioListener > constructor defaults', () => {
  let ctx = new AudioContext()
  let l = ctx.listener
  is(l.position.toArray(), [0, 0, 0])
  is(l.orientation.toArray(), [0, 0, -1])
  is(l.upVector.toArray(), [0, 1, 0])
  is(l.velocity.toArray(), [0, 0, 0])
})

test('AudioListener > setPosition', () => {
  let ctx = new AudioContext()
  let l = ctx.listener
  l.setPosition(1, 2, 3)
  is(l.position.toArray(), [1, 2, 3])
})

test('AudioListener > setOrientation', () => {
  let ctx = new AudioContext()
  let l = ctx.listener
  l.setOrientation(1, 0, 0, 0, 0, 1)
  is(l.orientation.toArray(), [1, 0, 0])
  is(l.upVector.toArray(), [0, 0, 1])
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
