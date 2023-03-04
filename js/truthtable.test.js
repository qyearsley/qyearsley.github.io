// import { dedupe, combinations, prependToAll } from './truthtable';

const tt = require("./truthtable")

describe("dedupe", () => {
  test("dedupe empty list", () => {
    expect(tt.dedupe([])).toStrictEqual([])
  })

  test("simple case", () => {
    expect(tt.dedupe([1, 1])).toStrictEqual([1])
  })

  test("multi out of order", () => {
    expect(tt.dedupe([1, 4, 3, 3, 4, 1, 3, 1])).toStrictEqual([1, 3, 4])
  })
})

describe("combinations", () => {
  test("empty", () => {
    expect(tt.combinations(0)).toStrictEqual([[]])
  })

  test("length one", () => {
    expect(tt.combinations(1)).toStrictEqual([[false], [true]])
  })

  test("length two", () => {
    expect(tt.combinations(2)).toStrictEqual([
      [false, false],
      [false, true],
      [true, false],
      [true, true],
    ])
  })
})

describe("prependToAll", () => {
  test("empty", () => {
    expect(tt.prependToAll(0, [])).toStrictEqual([])
  })

  test("one", () => {
    expect(tt.prependToAll(0, [[1]])).toStrictEqual([[0, 1]])
  })

  test("two", () => {
    expect(tt.prependToAll(0, [[1], [2]])).toStrictEqual([
      [0, 1],
      [0, 2],
    ])
  })
})
