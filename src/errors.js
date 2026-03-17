// W3C Web Audio API error types

class AudioError extends Error {
  constructor(msg, name) { super(msg); this.name = name }
}

export class InvalidStateError extends AudioError {
  constructor(msg = 'Invalid state') { super(msg, 'InvalidStateError') }
}

export class NotSupportedError extends AudioError {
  constructor(msg = 'Not supported') { super(msg, 'NotSupportedError') }
}

export class IndexSizeError extends AudioError {
  constructor(msg = 'Index out of range') { super(msg, 'IndexSizeError') }
}

export class InvalidAccessError extends AudioError {
  constructor(msg = 'Invalid access') { super(msg, 'InvalidAccessError') }
}

export class EncodingError extends AudioError {
  constructor(msg = 'Encoding error') { super(msg, 'EncodingError') }
}
