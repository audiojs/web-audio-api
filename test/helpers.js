var assert = require('assert')
  , _ = require('underscore')

module.exports = function(opts) {

  opts = opts || {}
  _.defaults(opts, {approx: 0.0001})

  var assertAllValuesEqual = function(array, testVal) {
    for (var i = 0; i < array.length; i++) assert.equal(array[i], testVal)
  }

  var assertAllValuesApprox = function(array, testVal) {
    for (var i = 0; i < array.length; i++) assertApproxEqual(array[i], testVal)
  }

  var assertAllValuesFunc = function(block, Tb, testFunc, Ts) {
    var t = Tb
      , testVal
      , i
    Ts = Ts || 1/44100
    for (i = 0; i < block.length; i++) {
      testVal = testFunc(t, Tb)
      assertApproxEqual(testVal, block[i])
      t += Ts
    }
  }

  var assertApproxEqual = function(val1, val2) {
    var test = Math.abs(val1 - val2) < opts.approx
    if (test) assert.ok(test)
    else assert.equal(val1, val2)
  }
  
  return {
    assertAllValuesEqual: assertAllValuesEqual,
    assertAllValuesApprox: assertAllValuesApprox,
    assertAllValuesFunc: assertAllValuesFunc,
    assertApproxEqual: assertApproxEqual
  }

}