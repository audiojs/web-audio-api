import OfflineAudioContext from '../src/OfflineAudioContext.js'

// The unchanged hero module builds its graph into an offline context in the worker.
export let context
export class AudioContext extends OfflineAudioContext {
  constructor() {
    super(2, 6 * 44100, 44100)
    context = this
  }
  resume() { return Promise.resolve() }
  close() { return Promise.resolve() }
}
