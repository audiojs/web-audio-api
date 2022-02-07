import assert from 'assert'
import _ from 'underscore'
import AudioNode from '../src/AudioNode.js'

describe('AudioNode', function() {

  var dummyContext = {}

  it('should create AudioInputs and AudioOutputs', function() {
    var node = new AudioNode(dummyContext, 1, 2)
    assert.equal(node._inputs.length, 1)
    assert.equal(node._outputs.length, 2)

    assert.equal(node._inputs[0].id, 0)
    assert.equal(node._inputs[0].node, node)
    assert.equal(node._inputs[0].context, dummyContext)

    assert.equal(node._outputs[0].id, 0)
    assert.equal(node._outputs[0].node, node)
    assert.equal(node._outputs[0].context, dummyContext)

    assert.equal(node._outputs[1].id, 1)
    assert.equal(node._outputs[1].node, node)
    assert.equal(node._outputs[1].context, dummyContext)
  })

  it('should inherit from EventEmitter', function() {
    var node = new AudioNode(dummyContext, 1, 2)
    assert.ok(node.on)
    assert.ok(node.once)
  })

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

    it('should connect audio ports together', function() {
      var source = new AudioNode(dummyContext, 0, 3)
        , sink = new AudioNode(dummyContext, 3, 0)

      source.connect(sink)
      assert.equal(sink._inputs[0].sources.length, 1)
      assert.equal(sink._inputs[0].sources[0], source._outputs[0])

      // No change if connection already made
      source.connect(sink)
      assert.equal(sink._inputs[0].sources.length, 1)
      assert.equal(sink._inputs[0].sources[0], source._outputs[0])

      source.connect(sink, 2, 1)
      assert.equal(sink._inputs[1].sources.length, 1)
      assert.equal(sink._inputs[1].sources[0], source._outputs[2])
    })

    it('should throw an error if ouput or input out of bounds', function() {
      var source = new AudioNode(dummyContext, 0, 3)
        , sink = new AudioNode(dummyContext, 3, 0)
      assert.throws(function() { source.connect(source, 0, 5) })
      assert.throws(function() { source.connect(source, 6) })
    })

  })

  describe('disconnect', function() {

    it('should disconnect all sinks from the ouput', function() {
      var source = new AudioNode(dummyContext, 0, 3)
        , sink1 = new AudioNode(dummyContext, 3, 0)
        , sink2 = new AudioNode(dummyContext, 3, 0)

      source.connect(sink1, 1)
      source.connect(sink2, 1)
      source.connect(sink2, 2)
      assert.equal(source._outputs[0].sinks.length, 0)
      assert.equal(source._outputs[1].sinks.length, 2)
      assert.equal(source._outputs[2].sinks.length, 1)

      source.disconnect(1)
      assert.equal(source._outputs[0].sinks.length, 0)
      assert.equal(source._outputs[1].sinks.length, 0)
      assert.equal(source._outputs[2].sinks.length, 1)

      source.disconnect(2)
      assert.equal(source._outputs[0].sinks.length, 0)
      assert.equal(source._outputs[1].sinks.length, 0)
      assert.equal(source._outputs[2].sinks.length, 0)

      source.disconnect(0)
      assert.equal(source._outputs[0].sinks.length, 0)
      assert.equal(source._outputs[1].sinks.length, 0)
      assert.equal(source._outputs[2].sinks.length, 0)
    })

    it('should disconnect output 0 by default', function() {
      var source = new AudioNode(dummyContext, 0, 3)
        , sink1 = new AudioNode(dummyContext, 3, 0)
        , sink2 = new AudioNode(dummyContext, 3, 0)

      source.connect(sink1, 0)
      source.connect(sink2, 0)
      source.connect(sink2, 1)
      source.connect(sink2, 2)
      assert.equal(source._outputs[0].sinks.length, 2)
      assert.equal(source._outputs[1].sinks.length, 1)
      assert.equal(source._outputs[2].sinks.length, 1)

      source.disconnect()
      assert.equal(source._outputs[0].sinks.length, 0)
      assert.equal(source._outputs[1].sinks.length, 1)
      assert.equal(source._outputs[2].sinks.length, 1)
    })

    it('should throw an error if ouput or input out of bounds', function() {
      var source = new AudioNode(dummyContext, 0, 3)
        , sink = new AudioNode(dummyContext, 3, 0)
      assert.throws(function() { source.disconnect(8) })
    })

  })

  describe('_kill', function() {

    it('should disconnect all connections, and remove listeners', function() {
      var source = new AudioNode(dummyContext, 0, 3)
        , sink1 = new AudioNode(dummyContext, 3, 0)
        , sink2 = new AudioNode(dummyContext, 3, 0)

      source.connect(sink1, 1)
      source.connect(sink2, 1)
      source.connect(sink2, 2)
      source.on('bla', function() {})
      assert.equal(source.listeners('bla').length, 1)
      assert.equal(source._outputs[0].sinks.length, 0)
      assert.equal(source._outputs[1].sinks.length, 2)
      assert.equal(source._outputs[2].sinks.length, 1)

      source._kill()
      assert.equal(source.listeners('bla').length, 0)
      assert.equal(source._outputs[0].sinks.length, 0)
      assert.equal(source._outputs[1].sinks.length, 0)
      assert.equal(source._outputs[2].sinks.length, 0)
    })

  })

})

/*
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
*/
