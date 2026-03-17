// W3C Web Audio API error types
// Uses DOMException directly when available, plain Error otherwise

// W3C Web Audio API error types
// Uses DOMException when available (browsers, Node 17+), plain Error otherwise
export class InvalidStateError extends (globalThis.DOMException || Error) {
  constructor(msg = 'Invalid state') { super(msg, 'InvalidStateError'); if (!globalThis.DOMException) this.name = 'InvalidStateError' }
}
export class NotSupportedError extends (globalThis.DOMException || Error) {
  constructor(msg = 'Not supported') { super(msg, 'NotSupportedError'); if (!globalThis.DOMException) this.name = 'NotSupportedError' }
}
export class IndexSizeError extends (globalThis.DOMException || Error) {
  constructor(msg = 'Index out of range') { super(msg, 'IndexSizeError'); if (!globalThis.DOMException) this.name = 'IndexSizeError' }
}
export class InvalidAccessError extends (globalThis.DOMException || Error) {
  constructor(msg = 'Invalid access') { super(msg, 'InvalidAccessError'); if (!globalThis.DOMException) this.name = 'InvalidAccessError' }
}
export class EncodingError extends (globalThis.DOMException || Error) {
  constructor(msg = 'Encoding error') { super(msg, 'EncodingError'); if (!globalThis.DOMException) this.name = 'EncodingError' }
}
