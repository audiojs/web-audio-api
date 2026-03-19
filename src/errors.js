// W3C Web Audio API error types
// Uses DOMException when available (browsers, Node 17+), plain Error otherwise

const _DOMException = globalThis.DOMException

export const DOMErr = _DOMException
  ? (msg, name) => new _DOMException(msg, name)
  : (msg, name) => { let e = new Error(msg); e.name = name; return e }

export class InvalidStateError extends (_DOMException || Error) {
  constructor(msg = 'Invalid state') { super(msg, 'InvalidStateError'); if (!_DOMException) this.name = 'InvalidStateError' }
}
export class NotSupportedError extends (_DOMException || Error) {
  constructor(msg = 'Not supported') { super(msg, 'NotSupportedError'); if (!_DOMException) this.name = 'NotSupportedError' }
}
export class IndexSizeError extends (_DOMException || Error) {
  constructor(msg = 'Index out of range') { super(msg, 'IndexSizeError'); if (!_DOMException) this.name = 'IndexSizeError' }
}
export class InvalidAccessError extends (_DOMException || Error) {
  constructor(msg = 'Invalid access') { super(msg, 'InvalidAccessError'); if (!_DOMException) this.name = 'InvalidAccessError' }
}
export class EncodingError extends (_DOMException || Error) {
  constructor(msg = 'Encoding error') { super(msg, 'EncodingError'); if (!_DOMException) this.name = 'EncodingError' }
}
