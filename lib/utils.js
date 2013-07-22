var _ = require('underscore')


module.exports.chainExtend = function() {
  var sources = Array.prototype.slice.call(arguments, 0)
    , parent = this
    , child = function() { parent.apply(this, arguments) }

  // Fix instanceof
  child.prototype = new parent()

  // extend with new properties
  _.extend.apply(this, [child.prototype, parent.prototype].concat(sources))

  child.extend = this.extend
  return child
}

// Simple helper to make defining a read-only attribute less verbose
module.exports.readOnlyAttr = function(obj, name, value) {
  Object.defineProperty(obj, name, {value: value, writable: false})
}