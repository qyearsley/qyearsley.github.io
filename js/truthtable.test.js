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

describe("BoolExpr", () => {
  const BE = tt.BoolExpr

  test("constructor", () => {
    const expr = new BE("const", true)
    expect(expr.type).toEqual("const")
    expect(expr.arg1).toEqual(true)
    expect(expr.arg2).toBe(undefined)
  })

  test("eval constant", () => {
    const expr = new BE("const", true)
    expect(expr.eval()).toEqual(true)
  })

  test("eval simple", () => {
    expect(new BE("and", new BE("const", true), new BE("const", true)).eval()).toEqual(true)
    expect(new BE("and", new BE("const", false), new BE("const", true)).eval()).toEqual(false)
    expect(new BE("or", new BE("const", true), new BE("const", false)).eval()).toEqual(true)
    expect(new BE("or", new BE("const", false), new BE("const", false)).eval()).toEqual(false)
  })

  test("invalid operator", () => {
    expect(() => new BE("asdf", true, true).eval()).toThrow()
  })

  test("missing second argument", () => {
    expect(() => new BE("and", new BE("const", true)).eval()).toThrow()
  })

  test("variable that is not a string", () => {
    expect(() => new BE("var", 1).eval()).toThrow()
  })

  test("eval complex", () => {
    expect(
      new BE("and", new BE("const", true), new BE("or", new BE("const", false), new BE("const", false))).eval()
    ).toEqual(false)
    expect(
      new BE("and", new BE("const", true), new BE("or", new BE("const", true), new BE("const", false))).eval()
    ).toEqual(true)
  })

  test("getVars", () => {
    expect(
      new BE("var", "asdf").getVars()
    ).toEqual(["asdf"])
  })

  test("getVars with repetition", () => {
    expect(
      new BE("and", new BE("var", "a"), new BE("var", "a")).getVars()
    ).toEqual(["a"])
  })

  test("getVars with two vars", () => {
    expect(
      new BE("and", new BE("var", "a"), new BE("var", "b")).getVars()
    ).toEqual(["a", "b"])
  })
})

describe("parsePrefix", () => {
  test("empty", () => {
    //expect(() => tt.parsePrefix("")).toThrow()
  })

  test("constant", () => {
    expect(tt.parsePrefix("true").eval()).toEqual(true)
    expect(tt.parsePrefix("false").eval()).toEqual(false)
  })

  test("simple", () => {
    expect(tt.parsePrefix("and true false").eval()).toEqual(false)
    expect(tt.parsePrefix("and true true").eval()).toEqual(true)
    expect(tt.parsePrefix("or true false").eval()).toEqual(true)
    expect(tt.parsePrefix("or false false").eval()).toEqual(false)
  })
})
