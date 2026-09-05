// Porffor alpha 4: "TypeError: Tried for..of on non-iterable type" for a class
// whose [Symbol.iterator]() delegates to an array's iterator (automation-events'
// AutomationEventList, read by AudioParam#_assertNotInCurve). Node prints 6.
// https://github.com/CanadaHonk/porffor/issues/380
class List {
  constructor() { this.items = [1, 2, 3] }
  [Symbol.iterator]() { return this.items[Symbol.iterator]() }
}
let sum = 0
for (const x of new List()) sum += x
console.log(sum)
