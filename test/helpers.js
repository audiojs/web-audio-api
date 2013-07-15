  var assert = require('assert')
    , BLOCK_SIZE = require('../lib/constants').BLOCK_SIZE

  module.exports.APPROX = 0.0001

  var assertAllValuesEqual = module.exports.assertAllValuesEqual = function(array, testVal) {
    for (var i = 0; i < array.length; i++) assert.equal(array[i], testVal)
  }

  var assertAllValuesApprox = module.exports.assertAllValuesApprox = function(array, testVal) {
    for (var i = 0; i < array.length; i++) assertApproxEqual(array[i], testVal)
  }

  var assertAllValuesFunc = module.exports.assertAllValuesFunc = function(block, Tb, testFunc, Ts) {
    var t = Tb
      , testVal
    Ts = Ts || 1/44100
    assert.equal(block.length, BLOCK_SIZE)
    block.forEach(function(val) {
      testVal = testFunc(t, Tb)
      assertApproxEqual(testVal, val)
      t += Ts
    })
  }

  var assertApproxEqual = module.exports.assertApproxEqual = function(val1, val2) {
    var test = Math.abs(val1 - val2) < module.exports.APPROX
    if (test) assert.ok(test)
    else assert.equal(val1, val2)
  }