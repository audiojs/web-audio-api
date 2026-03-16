import test from 'tst'
import { is } from 'tst'
import AudioListener from '../src/AudioListener.js'

test('AudioListener > constructor defaults', () => {
  let l = new AudioListener()
  is(l.position.toArray(), [0, 0, 0])
  is(l.orientation.toArray(), [0, 0, -1])
  is(l.upVector.toArray(), [0, 1, 0])
  is(l.velocity.toArray(), [0, 0, 0])
})

test('AudioListener > setPosition', () => {
  let l = new AudioListener()
  l.setPosition(1, 2, 3)
  is(l.position.toArray(), [1, 2, 3])
})

test('AudioListener > setOrientation', () => {
  let l = new AudioListener()
  l.setOrientation(1, 0, 0, 0, 0, 1)
  is(l.orientation.toArray(), [1, 0, 0])
  is(l.upVector.toArray(), [0, 0, 1])
})
