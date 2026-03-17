// W3C Web Audio API error types
// Uses DOMException directly when available, plain Error otherwise

const E = typeof DOMException === 'function'
  ? (name, msg) => new DOMException(msg, name)
  : (name, msg) => { let e = new Error(msg); e.name = name; return e }

export const err = {
  InvalidState: msg => E('InvalidStateError', msg || 'Invalid state'),
  NotSupported: msg => E('NotSupportedError', msg || 'Not supported'),
  IndexSize: msg => E('IndexSizeError', msg || 'Index out of range'),
  InvalidAccess: msg => E('InvalidAccessError', msg || 'Invalid access'),
  Encoding: msg => E('EncodingError', msg || 'Encoding error'),
}

// Legacy class exports for backward compat (throw new InvalidStateError(msg))
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
