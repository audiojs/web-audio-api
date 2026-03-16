import test from 'tst'
import { is, almost } from 'tst'
import { fixNANs, rad2deg, clampTo } from '../src/mathUtils.js'
import FloatPoint3D from '../src/FloatPoint3D.js'

// --- mathUtils ---

test('fixNANs > returns 0 for non-finite', () => {
  is(fixNANs(NaN), 0)
  is(fixNANs(Infinity), 0)
  is(fixNANs(-Infinity), 0)
  is(fixNANs(5), 5)
})

test('rad2deg > converts correctly', () => {
  almost(rad2deg(Math.PI), 180, 1e-10)
  almost(rad2deg(0), 0, 1e-10)
})

test('clampTo > clamps value to range', () => {
  is(clampTo(5, 0, 10), 5)
  is(clampTo(-1, 0, 10), 0)
  is(clampTo(15, 0, 10), 10)
})

// --- FloatPoint3D ---

test('FloatPoint3D > constructor and properties', () => {
  let p = new FloatPoint3D(1, 2, 3)
  is(p.x, 1)
  is(p.y, 2)
  is(p.z, 3)
  is(p.toArray(), [1, 2, 3])
})

test('FloatPoint3D > defaults to zero', () => {
  let p = new FloatPoint3D()
  is(p.x, 0)
  is(p.y, 0)
  is(p.z, 0)
})

test('FloatPoint3D > isZero', () => {
  is(new FloatPoint3D(0, 0, 0).isZero(), true)
  is(new FloatPoint3D(1, 0, 0).isZero(), false)
})

test('FloatPoint3D > norm and normSquared', () => {
  let p = new FloatPoint3D(3, 4, 0)
  is(p.normSquared(), 25)
  is(p.norm(), 5)
})

test('FloatPoint3D > normalize', () => {
  let p = new FloatPoint3D(3, 0, 0)
  p.normalize()
  almost(p.x, 1, 1e-10)
  almost(p.y, 0, 1e-10)
})

test('FloatPoint3D > dot product', () => {
  let a = new FloatPoint3D(1, 2, 3)
  let b = new FloatPoint3D(4, 5, 6)
  is(a.dot(b), 32) // 4+10+18
})

test('FloatPoint3D > cross product', () => {
  let a = new FloatPoint3D(1, 0, 0)
  let b = new FloatPoint3D(0, 1, 0)
  let c = a.cross(b)
  is(c.x, 0)
  is(c.y, 0)
  is(c.z, 1)
})

test('FloatPoint3D > add/sub/mul', () => {
  let a = new FloatPoint3D(1, 2, 3)
  let b = new FloatPoint3D(4, 5, 6)

  let s = a.add(b)
  is(s.toArray(), [5, 7, 9])

  let d = a.sub(b)
  is(d.toArray(), [-3, -3, -3])

  let m = a.mul(2)
  is(m.toArray(), [2, 4, 6])
})

test('FloatPoint3D > distanceTo', () => {
  let a = new FloatPoint3D(0, 0, 0)
  let b = new FloatPoint3D(3, 4, 0)
  is(a.distanceTo(b), 5)
})

test('FloatPoint3D > angleBetween', () => {
  let a = new FloatPoint3D(1, 0, 0)
  let b = new FloatPoint3D(0, 1, 0)
  almost(a.angleBetween(b), Math.PI / 2, 1e-10)
})
