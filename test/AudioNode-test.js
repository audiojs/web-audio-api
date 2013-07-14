var assert = require('assert')
  , _ = require('underscore')
  , async = require('async')
  , audionodes = require('../lib/AudioNode')

describe('AudioNode', function() {

  var dummyContext = {}

  describe('channelCount', function() {

    it('should accept valid values', function() {
      var node = new AudioNode(dummyContext, 1, 1)
      assert.equal(node.channelCount, 2)
      node.channelCount = 1
      assert.equal(node.channelCount, 1)
      node.channelCount = 109
      assert.equal(node.channelCount, 109)
    })

    it('should throw error when setting to unvalid values', function() {
      var node = new AudioNode(dummyContext, 1, 1)
      assert.throws(function() { node.channelCount = 0 })
      assert.throws(function() { node.channelCount = -10 })
    })

  })

  describe('channelCountMode', function() {

    it('should accept valid values', function() {
      var node = new AudioNode(dummyContext, 1, 1)
      assert.equal(node.channelCountMode, undefined)
      node.channelCountMode = 'max'
      assert.equal(node.channelCountMode, 'max')
      node.channelCountMode = 'clamped-max'
      assert.equal(node.channelCountMode, 'clamped-max')
      node.channelCountMode = 'explicit'
      assert.equal(node.channelCountMode, 'explicit')
    })

    it('should throw error when setting to unvalid values', function() {
      var node = new AudioNode(dummyContext, 1, 1)
      assert.throws(function() { node.channelCountMode = 'explicitttt' })
      assert.throws(function() { node.channelCountMode = 10 })
    })

  })

  describe('channelInterpretation', function() {

    it('should accept valid values', function() {
      var node = new AudioNode(dummyContext, 1, 1)
      assert.equal(node.channelInterpretation, undefined)
      node.channelInterpretation = 'speakers'
      assert.equal(node.channelInterpretation, 'speakers')
      node.channelInterpretation = 'discrete'
      assert.equal(node.channelInterpretation, 'discrete')
    })

    it('should throw error when setting to unvalid values', function() {
      var node = new AudioNode(dummyContext, 1, 1)
      assert.throws(function() { node.channelInterpretation = 'explicitttt' })
      assert.throws(function() { node.channelInterpretation = 10 })
    })

  })

  describe('connect', function() {
    var MySourceNode = audionodes.SourceNode.extend({
      init: function() {
        this.counter = 0
      },
      _onConnected: function() {
        this.counter++
      }
    })

    var MySinkNode = audionodes.SinkNode.extend({
      init: function() {
        this.counter = 0
      },
      _onConnected: function() {
        this.counter++
      }
    })

    it('should connect source->sink', function() {
    var source = new MySourceNode()
      , sink = new MySinkNode()
      sink.connect(source)
      source.connect(sink)
      sink.connect(source)
      sink.connect(source)
      assert.equal(sink.input, source)
      assert.equal(source.output, sink)
      assert.equal(source.counter, 1)
      assert.equal(sink.counter, 1)
    })

    it('should throw an error with sink->sink and source->source', function() {
    var source1 = new MySourceNode()
      , sink1 = new MySinkNode()
      , source2 = new MySourceNode()
      , sink2 = new MySinkNode()
      assert.throws(function() { sink1.connect(sink2) })
      assert.throws(function() { source1.connect(source2) })
    })
  })

})

describe('SourceNode', function() {

  describe('read', function() {
    
    var MySourceNode = audionodes.SourceNode.extend({
    
      init: function(channels) {
        this.counter = -1
        this.channels = channels || 1
      },
    
      getBlock: function(next) {
        this.counter++
        if (this.counter < 3) {
          if (this.channels === 1) {
            next(null, [_.range(this.counter * 10, (this.counter + 1) * 10)])
          } else {
            next(null, [
              _.range(this.counter * 10, (this.counter + 1) * 10),
              _.range(this.counter * 20, (this.counter + 1) * 20, 2)
            ])
          }
        } else {
          this.close()
          this.getBlock(next)
        }
      }
      
    })
    
    it('should read the right amount of data and buffer the surplus', function(done) {
      var node = new MySourceNode()
      assert.deepEqual(node._buffers, [[]])
      
      async.waterfall([
        function(next) {
          node.read(5, next)
        },
        function(block, next) {
          assert.deepEqual(block, [[0, 1, 2, 3, 4]])
          assert.deepEqual(node._buffers, [[5, 6, 7, 8, 9]])
          node.read(5, next)
        },
        function(block, next) {
          assert.deepEqual(block, [[5, 6, 7, 8, 9]])
          assert.deepEqual(node._buffers, [[]])
          node.read(12, next)
        },
        function(block) {
          assert.deepEqual(block, [[10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]])
          assert.deepEqual(node._buffers, [[22, 23, 24, 25, 26, 27, 28, 29]])
          done()
        }
      ])
    })
    
    it('should read the right amount of data and pad the missing data', function(done) {
      var node = new MySourceNode(2)
      assert.deepEqual(node._buffers, [[], []])
      
      async.waterfall([
        function(next) {
          node.read(25, next)
        },
        function(block, next) {
          assert.deepEqual(node._buffers, [[25, 26, 27, 28, 29], [50, 52, 54, 56, 58]])
          node.read(10, next)
        },
        function(block, next) {
          assert.deepEqual(block, [[25, 26, 27, 28, 29, 0, 0, 0, 0, 0], [50, 52, 54, 56, 58, 0, 0, 0, 0, 0]])
          assert.deepEqual(node._buffers, [[], []])
          node.read(5, next)
        },
        function(block) {
          assert.deepEqual(block, [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]])
          assert.deepEqual(node._buffers, [[], []])
          done()
        }
      ])
    })
    
  })

})
