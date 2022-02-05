import assert from 'assert'
import FloatPoint3D from '../src/FloatPoint3D.js'
import initHelpers from './helpers.js'

const helpers = initHelpers()

var assertApproxEqual = helpers.assertApproxEqual

describe('FloatPoint3D.js', function() {

  describe('constructor', function() {
    it('has 3 properties', function() {
      const p = new FloatPoint3D(1, 2, 3)
      assert.deepEqual(p.toArray(), [1, 2, 3], 'Properties are initialized with arguments')

      const q = new FloatPoint3D()
      assert.deepEqual(q.toArray(), [0, 0, 0], 'Properties are initialized with default value')
    })
  })

  describe('isZero', function() {
    it('returns booleans', function() {
      assert(new FloatPoint3D().isZero(), 'isZero() === true if all values are 0')
      assert(!new FloatPoint3D(0, 0, 1).isZero(), 'isZero() === false if not all values are 0')
    })
  })

  describe('normalize', function() {
    it('divides all properties with its norm', function() {
      const p = new FloatPoint3D()
      p.normalize()
      assert.deepEqual(p.toArray(), [0, 0, 0], 'Zero vector never changes')

      const q = new FloatPoint3D(1, 1, 1)
      q.normalize()
      assertApproxEqual(Math.pow(q.x, 2) + Math.pow(q.y, 2) + Math.pow(q.z, 2), 1)
    })
  })

  describe('dot', function() {
    it('computes the dot product', function() {
      const p = new FloatPoint3D(1, 2, 3)
      const q = new FloatPoint3D(4, 5, 6)
      assert.equal(p.dot(q), 32, 'It returns one float number')
      assert.equal(p.dot(q), q.dot(p), 'The dot product is commutative')
    })
  })

  describe('cross', function() {
    it('computes the cross product', function() {
      const p = new FloatPoint3D(1, 2, 3)
      const q = new FloatPoint3D(4, 5, 6)
      const r = p.cross(q)
      assert(r instanceof FloatPoint3D, 'It returns new FloatPoint3D instance')
      assert.deepEqual(r.toArray(), [-3, 6, -3], 'The result values are correct')
      assert.notDeepEqual(r, q.cross(p), 'The cross product is not commutative')
    })
  })

  describe('normSquared', function() {
    it('computes the dot product with itself', function() {
      const p = new FloatPoint3D(1, 2, 3)
      assert.equal(p.normSquared(), p.dot(p))
    })
  })

  describe('norm', function() {
    it('computes the norm', function() {
      const p = new FloatPoint3D(1, 2, 3)
      assert.equal(p.norm(), Math.sqrt(1 * 1 + 2 * 2 + 3 * 3))
    })
  })

  describe('distanceTo', function() {
    it('computes the norm', function() {
      const p = new FloatPoint3D(1, 2, 3)
      const q = new FloatPoint3D()
      assert.equal(p.distanceTo(q), p.norm())
    })
  })

  describe('add', function() {
    it('adds each properties', function() {
      const p = new FloatPoint3D(1, 2, 3)
      const q = new FloatPoint3D(4, 5, 6)
      const r = p.add(q)
      assert.deepEqual(r.toArray(), [5, 7, 9])
    })
  })

  describe('sub', function() {
    it('subtracts each properties', function() {
      const p = new FloatPoint3D(1, 2, 3)
      const q = new FloatPoint3D(4, 5, 6)
      const r = p.sub(q)
      assert.deepEqual(r.toArray(), [-3, -3, -3])
    })
  })

  describe('mul', function() {
    it('multiplies each properties', function() {
      const p = new FloatPoint3D(1, 2, 3)
      const q = p.mul(10)
      assert.deepEqual(q.toArray(), [10, 20, 30])
    })
  })

  describe('angleBetween', function() {
    it('computes the angle between 2 vectors', function() {
      assert.equal(
        new FloatPoint3D(1, 0, 0).angleBetween(new FloatPoint3D(0, 0, 1)),
        Math.PI / 2
      )
      assert.equal(
        new FloatPoint3D(1, 0, 0).angleBetween(new FloatPoint3D(0, 0, 1)),
        new FloatPoint3D(123, 0, 0).angleBetween(new FloatPoint3D(0, 0, 1000)),
        Math.PI / 2,
        'The angle does not change even if the scale of vectors changes'
      )
    })
  })

  describe('toArray', function() {
    it('returns values in Array form', function() {
      assert.deepEqual(new FloatPoint3D().toArray(), [0, 0, 0])
      assert.deepEqual(new FloatPoint3D(1, 2, 3).toArray(), [1, 2, 3])
    })
  })

})
